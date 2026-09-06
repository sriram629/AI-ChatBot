import os
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
os.environ['SECRET_KEY'] = 'test-secret-not-for-production'
os.environ['MONGO_URI'] = 'mongodb://localhost:27017'
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app import chat
from fastapi import HTTPException
from pydantic import ValidationError

class SessionControlTests(unittest.IsolatedAsyncioTestCase):
    async def test_delete_owned_session(self):
        session = SimpleNamespace(set=AsyncMock())
        with patch.object(chat, 'get_owned_session', AsyncMock(return_value=session)):
            self.assertEqual(await chat.delete_session('one', object()), {'deleted': True})
        session.set.assert_awaited_once_with({'is_deleted': True})

    async def test_delete_foreign_session_denied(self):
        with patch.object(chat, 'get_owned_session', AsyncMock(side_effect=HTTPException(404))):
            with self.assertRaises(HTTPException): await chat.delete_session('foreign', object())

    async def test_rename_owned_session(self):
        session = SimpleNamespace(session_id='one', title='old', set=AsyncMock())
        with patch.object(chat, 'get_owned_session', AsyncMock(return_value=session)):
            result = await chat.rename_session('one', chat.RenameSessionRequest(title='  New name  '), object())
        self.assertEqual(result['title'], 'New name')
        session.set.assert_awaited_once()
        self.assertEqual(session.set.call_args.args[0]['title'], 'New name')
        self.assertNotIn('is_deleted', session.set.call_args.args[0])

    async def test_deleted_and_foreign_sessions_are_inaccessible(self):
        from test_reliability import Field
        for result in (None, SimpleNamespace(is_deleted=True)):
            fake = SimpleNamespace(session_id=Field('session_id'), user_email=Field('user_email'),
                                   find_one=AsyncMock(return_value=result))
            with patch.object(chat, 'ChatSession', fake):
                with self.assertRaises(HTTPException):
                    await chat.get_owned_session('one', SimpleNamespace(email='owner'))
            fake.find_one.assert_awaited_once_with(('session_id', 'eq', 'one'), ('user_email', 'eq', 'owner'))

    async def test_rename_other_session_denied(self):
        with patch.object(chat, 'get_owned_session', AsyncMock(side_effect=HTTPException(404))):
            with self.assertRaises(HTTPException):
                await chat.rename_session('foreign', chat.RenameSessionRequest(title='new'), object())

    def test_invalid_names_rejected(self):
        for title in ('   ', 'x' * 101):
            with self.assertRaises(ValidationError): chat.RenameSessionRequest(title=title)
