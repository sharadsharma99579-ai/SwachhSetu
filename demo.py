"""Launch a localhost-only walkthrough with three preconfigured demo accounts."""
import argparse
import webbrowser
from functools import partial
from http.server import ThreadingHTTPServer
from pathlib import Path

from server import Handler, account, connect, initialize, load_gemini_settings, require


PASSWORD = 'SwachhDemo@2026'
ACCOUNTS = (
    ('Demo Citizen', 'citizen@swachhsetu.demo', 'citizen'),
    ('Demo Officer', 'officer@swachhsetu.demo', 'officer'),
    ('Demo Admin', 'admin@swachhsetu.demo', 'admin'),
)


class DemoHandler(Handler):
    def check_local_host(self):
        host = f'127.0.0.1:{self.server.server_port}'
        require(self.headers.get('Host') == host, f'Open http://{host} to use the demo.', 403)
        return host

    def get(self):
        self.check_local_host()
        if self.path == '/api/demo':
            return self.send(200, {'enabled': True})
        return super().get()

    def post(self):
        host = self.check_local_host()
        if self.path != '/api/demo/login':
            return super().post()
        require(self.headers.get('Origin', f'http://{host}') == f'http://{host}',
                'Use the demo page to sign in.', 403)
        role = self.body().get('role')
        email = next((email for _, email, candidate in ACCOUNTS if candidate == role), None)
        require(email, 'Choose a valid demo role.')
        return self.authenticate('/api/login', {'email': email, 'password': PASSWORD})


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, help='Override automatic port selection')
    parser.add_argument('--no-browser', action='store_true', help='Print the link without opening a browser')
    args = parser.parse_args()
    folder = Path(__file__).resolve().parent / 'data'
    folder.mkdir(exist_ok=True)
    database = folder / 'classic-demo.sqlite'
    initialize(database)
    with connect(database, True) as db:
        for name, email, role in ACCOUNTS:
            if not db.execute('SELECT 1 FROM users WHERE email=?', (email,)).fetchone():
                account(db, dict(name=name, email=email, password=PASSWORD), role)
    try:
        load_gemini_settings(folder / '.swachhsetu-gemini.json')
    except (OSError, ValueError, TypeError, KeyError):
        parser.error('Could not read Gemini settings. Run python server.py --configure-gemini again.')
    handler = partial(DemoHandler, database=database, secure=False)
    try:
        if args.port is None:
            try:
                server = ThreadingHTTPServer(('127.0.0.1', 8000), handler)
            except OSError:
                server = ThreadingHTTPServer(('127.0.0.1', 0), handler)
        else:
            server = ThreadingHTTPServer(('127.0.0.1', args.port), handler)
        with server:
            url = f'http://127.0.0.1:{server.server_port}'
            print(f'Demo running at {url}', flush=True)
            print('Choose a demo role on the overview page. Keep this window open.', flush=True)
            if not args.no_browser:
                webbrowser.open(url)
            server.serve_forever()
    except KeyboardInterrupt:
        pass
    except OSError as error:
        parser.error(f'Could not start the local demo: {error}. Try --port 8001.')


if __name__ == '__main__':
    main()
