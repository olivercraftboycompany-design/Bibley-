import unittest

from backend.community import Community, NotFound


class CommunityTest(unittest.TestCase):
    def setUp(self):
        self.community = Community(':memory:')
        self.addCleanup(self.community.close)

    def test_requires_recipient_acceptance(self):
        c = self.community
        c.request_friend('a', 'b')
        c.request_friend('b', 'a')  # a simultaneous request isn't acceptance
        self.assertEqual(c.friends('a'), [{'account': 'b', 'state': 'outgoing'}])
        self.assertEqual(c.friends('b'), [{'account': 'a', 'state': 'incoming'}])
        with self.assertRaises(NotFound):
            c.accept_friend('a', 'b')
        with self.assertRaises(NotFound):
            c.share('a', 'b', 'prayer', 'kept private')
        c.accept_friend('b', 'a')
        self.assertEqual(c.friends('a'), [{'account': 'b', 'state': 'friend'}])

    def test_permissions_revoke_remove_and_copy(self):
        c = self.community
        c.request_friend('a', 'b')
        c.accept_friend('b', 'a')
        shared = c.share('a', 'b', 'prayer', 'explicit copy')
        self.assertEqual(c.inbox('b')[0]['content'], 'explicit copy')
        self.assertEqual(c.inbox('c'), [])
        self.assertEqual(c.inbox('a'), [])
        for other in ('b','c'):
            with self.assertRaises(NotFound):
                c.revoke(other, shared)
        c.revoke('a', shared)
        self.assertEqual(c.inbox('b'), [])
        c.share('b', 'a', 'encouragement', 'another copy')
        c.remove_friend('a', 'b')
        self.assertEqual(c.inbox('a'), [])
        with self.assertRaises(NotFound):
            c.share('a', 'b', 'note', 'cannot share')

    def test_validation(self):
        c = self.community
        with self.assertRaises(ValueError):
            c.request_friend('a', 'a')
        c.request_friend('a', 'b')
        c.accept_friend('b', 'a')
        for kind, value in [('public', 'unsupported'), ('note',''), ('note','a'*4001)]:
            with self.assertRaises(ValueError):
                c.share('a','b',kind,value)
