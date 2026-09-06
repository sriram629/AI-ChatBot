import asyncio
import base64
import io
import os
import sys
import unittest
from datetime import datetime, timedelta
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

os.environ["SECRET_KEY"] = "test-secret-not-for-production"
os.environ["MONGO_URI"] = "mongodb://localhost:27017"
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app import auth, chat, utils
from fastapi import HTTPException, WebSocketDisconnect
from PIL import Image

class Field:
    def __init__(self, name): self.name = name
    def __eq__(self, other): return (self.name, "eq", other)
    def __gt__(self, other): return (self.name, "gt", other)
    def __lt__(self, other): return (self.name, "lt", other)
    def __neg__(self): return self

class Tests(unittest.IsolatedAsyncioTestCase):
    async def test_expired_and_wrong_purpose_otp_rejected(self):
        user = SimpleNamespace(otp_code="123456", otp_purpose="verification",
                               otp_attempts=0, otp_expires_at=datetime.utcnow()-timedelta(seconds=1))
        with self.assertRaises(HTTPException):
            await auth.validate_otp(user, "123456", "verification")
        user.otp_expires_at = datetime.utcnow()+timedelta(minutes=10)
        with self.assertRaises(HTTPException):
            await auth.validate_otp(user, "123456", "password_reset")
        await auth.validate_otp(user, "123456", "verification")

    async def test_otp_attempt_limit(self):
        user = SimpleNamespace(otp_code="123456", otp_purpose="verification",
                               otp_attempts=5, otp_expires_at=datetime.utcnow()+timedelta(minutes=10))
        with self.assertRaises(HTTPException):
            await auth.validate_otp(user, "123456", "verification")

    async def test_profile_omits_secrets(self):
        user = SimpleNamespace(email="test@example.com", first_name="Test", last_name="User",
                               is_verified=True, is_active=True, hashed_password="private", otp_code="123456")
        result = await auth.read_users_me(user)
        self.assertNotIn("hashed_password", result)
        self.assertNotIn("otp_code", result)

    async def test_text_upload_and_errors(self):
        self.assertEqual(utils.parse_upload(b"document fact", "test.txt")["content"], "document fact")
        for data, name in [(b"bad", "test.exe"), (b"", "test.md"), (b"bad", "test.pdf")]:
            with self.assertRaises(HTTPException):
                utils.parse_upload(data, name)

    async def test_image_round_trip(self):
        data = io.BytesIO()
        Image.new("RGB", (2, 2), "blue").save(data, format="PNG")
        upload = utils.parse_upload(data.getvalue(), "test.png")
        part = utils.image_part(upload["content"])
        self.assertEqual(part["data"], data.getvalue())
        self.assertEqual(part["mime_type"], "image/png")
        with self.assertRaises(HTTPException): utils.image_part("invalid!")

    async def test_access_denied_before_socket_accept(self):
        socket = SimpleNamespace(close=AsyncMock(), accept=AsyncMock())
        with patch.object(chat, "get_ws_user", AsyncMock(return_value=object())), patch.object(
                chat, "get_owned_session", AsyncMock(side_effect=HTTPException(404))):
            await chat.websocket_endpoint(socket, "foreign", "token")
        socket.close.assert_awaited_once_with(code=1008)
        socket.accept.assert_not_awaited()

    async def test_stop_cancels_active_generation(self):
        started, cancelled = asyncio.Event(), asyncio.Event()
        async def generation(*args):
            started.set()
            try: await asyncio.sleep(100)
            finally: cancelled.set()
        events = iter([{"type": "message", "message": "hello"}, {"type": "stop"}])
        async def receive():
            try: event = next(events)
            except StopIteration: raise WebSocketDisconnect()
            if event["type"] == "stop": await started.wait()
            return event
        socket = SimpleNamespace(accept=AsyncMock(), receive_json=receive, send_json=AsyncMock())
        with patch.object(chat, "get_ws_user", AsyncMock(return_value=object())), patch.object(
                chat, "get_owned_session", AsyncMock(return_value=object())), patch.object(chat, "run_message", generation):
            await chat.websocket_endpoint(socket, "session", "token")
        self.assertTrue(cancelled.is_set())

    async def test_edit_and_regenerate_use_saved_message(self):
        for action in ("edit", "regenerate"):
            trigger = SimpleNamespace(id="0123456789abcdef01234567", content="old",
                                      attachments=[], timestamp=datetime.utcnow(), save=AsyncMock())
            deleted = AsyncMock()
            query = SimpleNamespace(delete=deleted)
            query.sort = lambda *args: query
            query.first_or_none = AsyncMock(return_value=trigger)
            fake = SimpleNamespace(**{name: Field(name) for name in ("id","session_id","user_email","role","timestamp")})
            fake.find_one = AsyncMock(return_value=trigger)
            fake.find = lambda *args: query
            session = SimpleNamespace(title="existing", save=AsyncMock())
            socket = SimpleNamespace(send_json=AsyncMock())
            # Halt at the model boundary, after edit/regenerate database selection.
            model = AsyncMock(side_effect=RuntimeError("model boundary"))
            payload = {"type": action, "messageId": str(trigger.id), "newContent": "edited"}
            with patch.object(chat, "ChatMessage", fake), patch.object(chat, "get_owned_session", AsyncMock(return_value=session)), patch.object(
                    chat, "has_session_documents", AsyncMock(return_value=False)), patch.object(
                    chat, "get_formatted_history", AsyncMock(return_value=[])), patch.object(chat, "call_gemini", model):
                with self.assertRaisesRegex(RuntimeError, "model boundary"):
                    await chat.process_message(socket, "session", SimpleNamespace(email="owner"), payload)
            self.assertEqual(model.call_args.args[0], "edited" if action == "edit" else "old")
            deleted.assert_awaited_once()
            if action == "edit": trigger.save.assert_awaited_once()

    async def test_disconnect_does_not_trigger_backup(self):
        socket = SimpleNamespace(send_json=AsyncMock(side_effect=RuntimeError("closed")))
        with self.assertRaises(asyncio.CancelledError):
            await chat.safe_send(socket, {"type": "chunk"})

    async def test_gemini_receives_image_bytes(self):
        data = io.BytesIO()
        Image.new("RGB", (2, 2), "blue").save(data, format="PNG")
        content = base64.b64encode(data.getvalue()).decode()
        async def chunks():
            yield SimpleNamespace(text="A blue square")
        send = AsyncMock(return_value=chunks())
        model = SimpleNamespace(start_chat=lambda **kwargs: SimpleNamespace(send_message_async=send))
        socket = SimpleNamespace(send_json=AsyncMock())
        with patch.object(chat, "gemini_model", model):
            result = await chat.call_gemini("Describe this", [], socket, "", [SimpleNamespace(type="image", content=content)])
        self.assertEqual(result, "A blue square")
        self.assertEqual(send.call_args.args[0][1]["data"], data.getvalue())

    async def test_database_health_failure_is_not_healthy(self):
        import main
        with patch.object(main, "ping_db", AsyncMock(side_effect=RuntimeError("offline"))):
            with self.assertRaises(HTTPException) as error:
                await main.health_check()
            self.assertEqual(error.exception.status_code, 503)
        with patch.object(main, "ping_db", AsyncMock()):
            self.assertEqual((await main.health_check())["database"], "reachable")

    async def test_intent_does_not_need_provider(self):
        self.assertEqual(chat.detect_intent("draw a picture of a dog"), "IMAGE")
        self.assertEqual(chat.detect_intent("explain rain"), "COMPLEX")

if __name__ == "__main__": unittest.main()
