# Copyright (C) 2018 Arthur de Jong
#
# Permission is hereby granted, free of charge, to any person obtaining a
# copy of this software and associated documentation files (the "Software"),
# to deal in the Software without restriction, including without limitation
# the rights to use, copy, modify, merge, publish, distribute, sublicense,
# and/or sell copies of the Software, and to permit persons to whom the
# Software is furnished to do so, subject to the following conditions:
#
# The above copyright notice and this permission notice shall be included in
# all copies or substantial portions of the Software.
#
# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
# IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
# FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
# AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
# LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
# FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
# DEALINGS IN THE SOFTWARE.

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
    return [json.dumps(get_info(), indent=2, sort_keys=True).encode('utf-8')]


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
    keys = (x for x in values[0].keys() if x != 'remove')
    keys = ['time'] + sorted(keys, key=_field_key)
    yield ('%s\n' % (','.join(keys))).encode('utf-8')
    for value in values:
        value['time'] = datetime.datetime.fromtimestamp(value['time']).strftime('%Y-%m-%d %H:%M:%S')
        yield ('%s\n' % (','.join(str(value.get(key, '')) for key in keys))).encode('utf-8')


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
