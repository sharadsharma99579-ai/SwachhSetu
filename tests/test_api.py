import base64
from concurrent.futures import ThreadPoolExecutor
from functools import partial
import http.cookiejar
from http.server import ThreadingHTTPServer
import json
from pathlib import Path
from tempfile import TemporaryDirectory
from threading import Thread
import unittest
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.request import HTTPCookieProcessor, Request, build_opener

from server import Handler, account, classify, connect, initialize

PHOTO = 'data:image/jpeg;base64,' + base64.b64encode(
    (Path(__file__).resolve().parents[1]/'public'/'icon.png').read_bytes()
).decode()
JPEG = 'data:image/jpeg;base64,' + base64.b64encode(
    (Path(__file__).resolve().parent/'sample.jpg').read_bytes()
).decode()
PASSWORD = 'Testing-only-12345'


class Client:
    def __init__(self, port):
        self.url = f'http://127.0.0.1:{port}'
        self.http = build_opener(HTTPCookieProcessor(http.cookiejar.CookieJar()))

    def call(self, path, body=None, csrf=True):
        headers = {'Content-Type':'application/json'}
        if csrf:
            headers['X-SwachhSetu']='1'
        req = Request(self.url+path, data=None if body is None else json.dumps(body).encode(),headers=headers)
        try:
            response = self.http.open(req, timeout=8)
        except HTTPError as error:
            response = error
        with response:
            data = response.read()
            return response.code, json.loads(data) if response.headers.get_content_type()=='application/json' else data


class QuietHandler(Handler):
    def log_message(self,*args):
        pass


class Pilot(unittest.TestCase):
    def setUp(self):
        self.folder = TemporaryDirectory()
        self.addCleanup(self.folder.cleanup)
        self.db = Path(self.folder.name)/'pilot.sqlite'
        initialize(self.db)
        with connect(self.db,True) as db:
            self.admin_id = account(db,dict(name='Admin',email='admin@example.test',password=PASSWORD),'admin')
            self.officer_id = account(db,dict(name='Officer',email='officer@example.test',password=PASSWORD),'officer')
            self.other_officer_id = account(db,dict(name='Other Officer',email='second@example.test',password=PASSWORD),'officer')
        httpd = ThreadingHTTPServer(('127.0.0.1',0),partial(QuietHandler,database=self.db,secure=False))
        self.port = httpd.server_port
        thread = Thread(target=httpd.serve_forever,daemon=True)
        thread.start()
        self.addCleanup(httpd.server_close)
        self.addCleanup(httpd.shutdown)
        self.citizen = self.client('citizen@example.test', signup=True, role='admin')
        self.admin = self.client('admin@example.test')
        self.officer = self.client('officer@example.test')
        self.other = self.client('second@example.test')

    def client(self,email,signup=False,**extra):
        client = Client(self.port)
        self.assertEqual(client.call('/api/'+('signup' if signup else 'login'),
                         dict(name='Test citizen',email=email,password=PASSWORD,**extra))[0],200)
        return client

    def report(self, **extra):
        return dict(dict(issue='Overflowing bin',description='There is an overflowing bin.',
                         location='Example park',lat=28.75,lon=77.10,photos=[JPEG]), **extra)

    def move(self,client,complaint,status,**details):
        return client.call('/api/transition',dict(id=complaint,status=status,**details))[0]

    def test_roles_workflow_proof_reopen_resolution_and_csv(self):
        self.assertEqual(Client(self.port).call('/api/dashboard')[0],401)
        self.assertEqual(self.citizen.call('/api/dashboard')[1]['user']['role'],'citizen')
        code, created = self.citizen.call('/api/complaint',self.report())
        self.assertEqual(code,200,created)
        complaint = created['id']
        self.assertEqual(self.other.call('/api/dashboard')[1]['complaints'],[])
        self.assertEqual(self.move(self.other,complaint,'In Progress'),404)
        self.assertEqual(self.move(self.citizen,complaint,'Assigned',officer=self.officer_id,ward='Ward 1'),409)
        self.assertEqual(self.move(self.admin,complaint,'Resolved'),409)
        self.assertEqual(self.move(self.admin,complaint,'Under Review'),200)
        self.assertEqual(self.move(self.admin,complaint,'Assigned',officer=self.officer_id,ward='Ward 1'),200)
        self.assertEqual(self.move(self.officer,complaint,'In Progress'),200)
        self.assertEqual(self.move(self.officer,complaint,'Awaiting Verification'),400)
        self.assertEqual(self.move(self.officer,complaint,'Awaiting Verification',photos=[JPEG]),200)
        self.assertEqual(self.move(self.citizen,complaint,'Reopened',note='Waste remains nearby.'),200)
        self.assertEqual(self.move(self.admin,complaint,'Assigned',officer=self.officer_id,ward='Ward 1'),200)
        self.assertEqual(self.move(self.officer,complaint,'In Progress'),200)
        self.assertEqual(self.move(self.officer,complaint,'Awaiting Verification',photos=[JPEG]),200)
        self.assertEqual(self.move(self.citizen,complaint,'Resolved'),200)
        row = self.citizen.call('/api/dashboard')[1]['complaints'][0]
        self.assertEqual(row['status'],'Resolved')
        self.assertEqual(len(row['events']),10)
        path = '/api/photo/'+row['photos'][0]['id']
        self.assertEqual(self.citizen.call(path)[0],200)
        self.assertEqual(self.other.call(path)[0],404)
        self.assertEqual(self.citizen.call('/api/report.csv')[0],403)
        self.assertIn(complaint.encode(),self.admin.call('/api/report.csv')[1])

    def test_duplicates_support_validation_and_csrf(self):
        self.assertEqual(self.citizen.call('/api/complaint',self.report(),csrf=False)[0],403)
        self.assertEqual(self.citizen.call('/api/complaint',self.report(photos=[PHOTO]))[0],400)
        self.assertEqual(self.citizen.call('/api/complaint',self.report(lat=98))[0],400)
        _, created = self.citizen.call('/api/complaint',self.report())
        other = self.client('other@example.test',signup=True)
        code, duplicate = other.call('/api/complaint',self.report())
        self.assertEqual(code,200)
        self.assertEqual(duplicate['matches'][0]['id'],created['id'])
        support = dict(id=created['id'],issue='Overflowing bin',lat=28.75,lon=77.10)
        self.assertEqual(other.call('/api/support',support)[0],200)
        self.assertEqual(other.call('/api/support',support)[0],200)
        self.assertEqual(self.admin.call('/api/dashboard')[1]['complaints'][0]['support'],1)
        self.assertEqual(other.call('/api/complaint',self.report(submit_separately=True))[0],200)

    def test_scanner_cap_and_idempotent_redemption(self):
        with patch.dict('os.environ',{'GEMINI_API_KEY':'','GEMINI_MODEL':''}):
            self.assertEqual(self.citizen.call('/api/scanner',dict(mode='gemini',photo=JPEG))[0],503)
        _, sample = self.citizen.call('/api/scanner',dict(mode='sample'))
        self.assertEqual(sample['source'],'Demo sample')
        self.assertEqual(self.citizen.call('/api/scan/confirm',dict(id=sample['id'],category='Wet'))[1]['earned'],0)
        for index in range(6):
            _, scan = self.citizen.call('/api/scanner',dict(mode='manual',category='Dry'))
            details = dict(id=scan['id'],category='Wet',feedback='Corrected during testing')
            self.assertEqual(self.citizen.call('/api/scan/confirm',details)[1]['earned'],2 if index<5 else 0)
            self.assertEqual(self.citizen.call('/api/scan/confirm',details)[0],409)
        with ThreadPoolExecutor(max_workers=2) as executor:
            attempts = list(executor.map(lambda n:self.citizen.call('/api/redeem',dict(id='cafe',request='testing-request-'+str(n)))[0],range(2)))
        self.assertEqual(sorted(attempts),[200,409])
        data = self.citizen.call('/api/dashboard')[1]
        self.assertEqual(sum(row['points'] for row in data['ledger']),0)
        self.assertEqual(len(data['ledger']),6)
        successful_request = next(row['reason'].split()[-1] for row in data['ledger'] if row['points']<0)
        self.assertEqual(self.citizen.call('/api/redeem',dict(id='cafe',request=successful_request))[0],200)

    def test_gemini_response_format_with_stubbed_provider(self):
        raw = dict(category='Unknown / mixed',items=['Cardboard','Electronics'],explanation='Mixed items.',needs_review=False)
        candidate = {'candidates':[{'content':{'parts':[{'text':json.dumps(raw)}]}}]}
        with patch.dict('os.environ',{'GEMINI_API_KEY':'test-key','GEMINI_MODEL':'test-model'}), patch('server.urlopen') as provider:
            provider.return_value.__enter__.return_value.read.return_value = json.dumps(candidate).encode()
            result = classify(b'example')
            self.assertEqual(result['source'],'Gemini')
            self.assertTrue(result['review'])
            provider.return_value.__enter__.return_value.read.return_value = b'{}'
            self.assertEqual(self.citizen.call('/api/scanner',dict(mode='gemini',photo=JPEG))[0],502)

    def test_session_logout(self):
        self.assertEqual(self.citizen.call('/api/login',dict(email='citizen@example.test',password='wrong'))[0],401)
        self.assertEqual(self.citizen.call('/api/logout',{})[0],200)
        self.assertEqual(self.citizen.call('/api/dashboard')[0],401)


if __name__=='__main__':
    unittest.main()
