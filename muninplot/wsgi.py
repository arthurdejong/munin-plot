# Copyright (C) 2018-2025 Arthur de Jong
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

"""Simple WSGI application to run the munin-plot application."""

import json
import os
import time
import traceback
import urllib.parse

import pkg_resources

from muninplot.data import get_info, get_values


# The directory that contains the JSON files that describe the dashboards
DASHBOARDS_DIR = os.environ.get('DASHBOARDS_DIR', None)


# The value of the Content-Security-Policy header
CSP_VALUE = "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; " + \
            "script-src 'self' 'unsafe-eval'; frame-ancestors 'none'"


def notfound_response(start_response):
    """Return a 404 NOT FOUND response."""
    start_response('404 NOT FOUND', [
        ('Content-Type', 'text/plain'),
        ('Content-Security-Policy', CSP_VALUE)])
    return [b'NOT FOUND']


def static_serve(environ, start_response):
    """Server static files that are shipped with the package."""
    path = environ.get('PATH_INFO', '').lstrip('/') or 'index.html'
    path = os.path.normpath(os.sep + path).lstrip(os.sep)
    if path.endswith('.html'):
        content_type = 'text/html; charset=utf-8'
    elif path.endswith('.js'):
        content_type = 'text/javascript'
    elif path.endswith('.css'):
        content_type = 'text/css'
    elif path.endswith('.png'):
        content_type = 'image/png'
    elif path.endswith('.ico'):
        content_type = 'image/vnd.microsoft.icon'
    else:
        content_type = 'application/octet-stream'
    path = os.path.join('static', path)
    if not pkg_resources.resource_exists('muninplot', path):
        return notfound_response(start_response)
    start_response('200 OK', [
        ('Content-Type', content_type),
        ('Content-Security-Policy', CSP_VALUE)])
    return [pkg_resources.resource_stream('muninplot', path).read()]


def list_graphs(environ, start_response):
    """Return the known Munin graphs as JSON."""
    start_response('200 OK', [
        ('Content-Type', 'application/json')])
    return [json.dumps(get_info(), indent=2, sort_keys=True).encode('utf-8')]


def list_dashboards(environ, start_response):
    """Return the configured dashboards as JSON."""
    dashboards = {}
    # Go over DASHBOARDS_DIR and load JSON files from that
    dashboards_dir = environ.get('DASHBOARDS_DIR', DASHBOARDS_DIR)
    if dashboards_dir and os.path.isdir(dashboards_dir):
        for filename in sorted(os.listdir(dashboards_dir)):
            filename = os.path.join(dashboards_dir, filename)
            if filename.endswith('.json') and os.path.isfile(filename):
                try:
                    with open(filename, 'rt') as f:
                        dashboard = json.load(f)
                        dashboard.setdefault('name', os.path.basename(filename)[:-5])
                        dashboards[dashboard['name']] = dashboard
                except Exception:
                    traceback.print_exc(file=environ['wsgi.errors'])
    start_response('200 OK', [
        ('Content-Type', 'application/json')])
    return [json.dumps(dashboards, indent=2, sort_keys=True).encode('utf-8')]


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
        '%Y-%m-%dT%H:%M:%S',
        '%Y-%m-%d %H:%M',
        '%Y-%m-%dT%H:%M',
        '%Y-%m-%d')
    for fmt in formats:
        try:
            return int(time.mktime(time.strptime(timestamp, fmt)))
        except ValueError:
            pass
    raise ValueError('time data %r does not match any known format' % timestamp)


def get_data(environ, start_response):
    """Return a data series for the graph as CSV."""
    path = environ.get('PATH_INFO', '').lstrip('/').removeprefix('data/')
    if path not in get_info():
        return notfound_response(start_response)
    group, host, graph = path.split('/')
    parameters = urllib.parse.parse_qs(environ.get('QUERY_STRING', ''))
    # get the time range to fetch the data for
    end = parameters.get('end')
    end = _parse_timestamp(end[0]) if end else time.time()
    start = parameters.get('start')
    start = _parse_timestamp(start[0]) if start else end - 24 * 60 * 60 * 7
    # return the values as CSV
    start_response('200 OK', [
        ('Content-Type', 'text/csv')])
    for values in get_values(group, host, graph, start, end):
        if not isinstance(values[0], str):
            values[0] = time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(values[0]))
        yield ('%s\n' % (','.join(str('' if value is None else value) for value in values))).encode('utf-8')


def application(environ, start_response):
    """Serve munin-plot WSGI application."""
    # override MUNIN_DBDIR
    if 'MUNIN_DBDIR' in environ:
        import muninplot.data
        muninplot.data.MUNIN_DBDIR = environ['MUNIN_DBDIR']
    # get request path
    path = environ.get('PATH_INFO', '').lstrip('/')
    if path.startswith('graphs'):
        return list_graphs(environ, start_response)
    if path.startswith('dashboards'):
        return list_dashboards(environ, start_response)
    elif path.startswith('data/'):
        return get_data(environ, start_response)
    else:
        return static_serve(environ, start_response)
