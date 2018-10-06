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

import cgi
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


def _parse_timestamp(timestamp):
    """Return a timestamp value from the specified string."""
    formats = (
        '%Y-%m-%d %H:%M:%S',
        '%Y-%m-%d %H:%M',
        '%Y-%m-%d')
    for fmt in formats:
        try:
            return time.mktime(time.strptime(timestamp, fmt))
        except ValueError:
            pass
    raise ValueError('time data %r does not match any known format' % timestamp)


def get_data(environ, start_response):
    path = environ.get('PATH_INFO', '').lstrip('/')
    _, group, host, graph = path.split('/')
    last_update, resolutions = get_resolutions(group, host, graph)
    parameters = cgi.parse_qs(environ.get('QUERY_STRING', ''))
    # get the time range to fetch the data for
    end = parameters.get('end')
    end = _parse_timestamp(end[0]) if end else last_update
    start = parameters.get('start')
    start = _parse_timestamp(start[0]) if start else end - 24 * 60 * 60 * 7
    # calculate the minimum resolution that we want
    resolution = min((
        parameters.get('resolution', (end - start) / 5000),
        resolutions[-1][0]))
    # loop over resolutions to find the data
    values = []
    for res, rows in resolutions:
        if res >= resolution:
            s = max((last_update - res * rows, start))
            e = min((last_update, end))
            if e > s:
                values = get_values(group, host, graph, s, e, res) + values
                end = s
    # return the values as CSV
    start_response('200 OK', [
        ('Content-Type', 'text/plain')])
    if values:
        keys = (x for x in values[0].keys() if x != 'remove')
        keys = ['time'] + sorted((k for k in keys if k != 'time'), key=_field_key)
        yield ('%s\n' % (','.join(keys))).encode('utf-8')
        for value in values:
            value['time'] = time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(value['time']))
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
