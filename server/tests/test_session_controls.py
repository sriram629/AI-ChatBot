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
    async def test_rename_owned_session(self):
        session = SimpleNamespace(session_id='one', title='old', save=AsyncMock())
        with patch.object(chat, 'get_owned_session', AsyncMock(return_value=session)):
            result = await chat.rename_session('one', chat.RenameSessionRequest(title='  New name  '), object())
        self.assertEqual(result['title'], 'New name')
        session.save.assert_awaited_once()

    async def test_rename_other_session_denied(self):
        with patch.object(chat, 'get_owned_session', AsyncMock(side_effect=HTTPException(404))):
            with self.assertRaises(HTTPException):
                await chat.rename_session('foreign', chat.RenameSessionRequest(title='new'), object())

    def test_invalid_names_rejected(self):
        for title in ('   ', 'x' * 101):
            with self.assertRaises(ValidationError): chat.RenameSessionRequest(title=title)
