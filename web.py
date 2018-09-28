import datetime
import json
import os
import sys
import time

from munin import *

sys.stdout = sys.stderr


def static_serve(environ, start_response):
    path = environ.get('PATH_INFO', '').lstrip('/') or 'index.html'
    path = os.path.normpath(os.sep + path).lstrip(os.sep)
    content_type = 'text/html'
    if path.endswith('.js'):
        content_type = 'text/javascript'
    elif path.endswith('.css'):
        content_type = 'text/css'
    start_response('200 OK', [
        ('Content-Type', content_type),
        ('Content-Security-Policy', "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-eval'; frame-ancestors 'none'")])
    return [open(os.path.join('static', path), 'rb').read()]


def list_graphs(environ, start_response):
    start_response('200 OK', [
        ('Content-Type', 'application/json')])
    return [json.dumps(get_info(), indent=2, sort_keys=True)]


def _field_key(x):
    """Order field.min, field, field.max."""
    if x.endswith('.min'):
        return x[:-4] + '.0'
    elif x.endswith('.max'):
        return x[:-4] + '.2'
    return x + '.1'


def get_data(environ, start_response):
    path = environ.get('PATH_INFO', '').lstrip('/')
    _, group, host, graph = path.split('/')
    start_response('200 OK', [
        ('Content-Type', 'text/plain')])
    end = time.time()
    start = end - 24 * 60 * 60 * 7
    values = get_values(group, host, graph, start, end)
    keys = values[0].keys()
    keys.remove('time')
    keys = ['time'] + sorted(keys, key=_field_key)
    yield '%s\n' % (','.join(keys))
    for value in values:
        value['time'] = datetime.datetime.fromtimestamp(value['time']).strftime('%Y-%m-%d %H:%M:%S')
        yield '%s\n' % (','.join(str(value.get(key, '')) for key in keys))


def application(environ, start_response):
    # get request path
    path = environ.get('PATH_INFO', '').lstrip('/')
    if path.startswith('graphs'):
        return list_graphs(environ, start_response)
    elif path.startswith('data/'):
        return get_data(environ, start_response)
    else:
        return static_serve(environ, start_response)


if __name__ == '__main__':
    from wsgiref.simple_server import make_server
    srv = make_server('0.0.0.0', 8080, application)
    srv.serve_forever()
