"""Local-only static preview with byte-range support for MP3 seeking."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import re


class AudioPreviewHandler(SimpleHTTPRequestHandler):
    def send_head(self):
        self.byte_range = None
        target = Path(self.translate_path(self.path))
        if not target.is_file():
            return super().send_head()
        try:
            stream = target.open('rb')
        except OSError:
            self.send_error(404)
            return None
        size = target.stat().st_size
        start, end = 0, size - 1
        header = self.headers.get('Range')
        if header:
            match = re.fullmatch(r'bytes=(\d*)-(\d*)', header.strip())
            if not match or not any(match.groups()):
                stream.close()
                self.send_error(400, 'Unsupported byte range')
                return None
            left, right = match.groups()
            if left:
                start = int(left)
                end = min(int(right), size-1) if right else size-1
            else:
                start = max(0, size-int(right))
            if start > end or start >= size:
                stream.close()
                self.send_response(416)
                self.send_header('Content-Range', f'bytes */{size}')
                self.send_header('Content-Length', '0')
                self.end_headers()
                return None
            self.byte_range = (start, end)
            self.send_response(206)
            self.send_header('Content-Range', f'bytes {start}-{end}/{size}')
            stream.seek(start)
        else:
            self.send_response(200)
        self.send_header('Accept-Ranges', 'bytes')
        self.send_header('Content-Type', self.guess_type(str(target)))
        self.send_header('Content-Length', str(end-start+1))
        self.send_header('Last-Modified', self.date_time_string(target.stat().st_mtime))
        self.send_header('Cache-Control', 'no-cache')
        self.end_headers()
        return stream

    def copyfile(self, source, outputfile):
        if self.byte_range is None:
            return super().copyfile(source, outputfile)
        remaining = self.byte_range[1] - self.byte_range[0] + 1
        try:
            while remaining:
                block = source.read(min(65536, remaining))
                if not block:
                    break
                outputfile.write(block)
                remaining -= len(block)
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            pass  # Browser cancelled a previous media request after seeking.


if __name__ == '__main__':
    directory = str(Path(__file__).parent / 'dist')
    server = ThreadingHTTPServer(('127.0.0.1', 8032), partial(AudioPreviewHandler, directory=directory))
    print('Jelly flow: http://127.0.0.1:8032', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.server_close()
