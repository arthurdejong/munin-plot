# Copyright (C) 2018-2020 Arthur de Jong
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

"""Module that exposes the Munin data."""

import math
import os
import re
import subprocess
import time
from collections import defaultdict
from functools import wraps


# The directory that contains the Munin data files.
# This is the dbdir option in munin.conf.
MUNIN_DBDIR = os.environ.get('MUNIN_DBDIR', '/var/lib/munin')


def cache(function):
    """Cache returned data of the decorated function."""
    data = dict()

    @wraps(function)
    def wrapper(*args):
        now = time.time()
        if args not in data or data[args][1] < now - 300:
            data[args] = (function(*args), now)
        return data[args][0]
    return wrapper


def _remove_duplicates(lst):
    """Remove duplicate values from the list while maintaining order."""
    seen = set()
    for x in lst:
        if x not in seen:
            seen.add(x)
            yield x


@cache
def get_info():
    """Return a description of all the graphs."""
    data = defaultdict(dict)
    # parse the datafile and group by graph
    with open(os.path.join(MUNIN_DBDIR, 'datafile'), 'rt', encoding='utf-8') as f:
        for line in f:
            if ':' in line:
                source, line = line.split(':', 1)
                group, host = source.split(';')
                key, value = line.split(' ', 1)
                if '.' in key:
                    graph, key = key.split('.', 1)
                    name = '%s/%s/%s' % (group, host, graph)
                    data[name][key] = value.strip()
    # restructure graph info
    for name, info in data.items():
        # collect field information
        fields = dict()
        for key, value in list(info.items()):
            if '.' in key:
                info.pop(key)
                field, key = key.split('.', 1)
                fields.setdefault(field, dict(name=field))
                if key not in ('graph_data_size', 'update_rate'):
                    fields[field][key] = value
        # remove graph=no from negative fields
        for _field, field_info in fields.items():
            negative = field_info.get('negative')
            if negative:
                fields[negative].pop('graph', None)
                fields[negative].setdefault('draw', field_info.get('draw', 'LINE'))
        # remove graph = no and replace by removing draw
        for _field, field_info in fields.items():
            if field_info.pop('graph', '').lower() in ('false', 'no', '0'):
                field_info.pop('draw', None)
            else:
                field_info.setdefault('draw', 'LINE')
        # expand graph_vlabel
        graph_vlabel = info.get('graph_vlabel', '')
        if '${graph_period}' in graph_vlabel:
            info['graph_vlabel'] = graph_vlabel.replace(
                '${graph_period}', info.get('graph_period', 'second'))
        info['name'] = name
        info['group'], info['host'], _ = name.split('/')
        graph_order = info.pop('graph_order', '')
        info['fields'] = [
            fields[field]
            for field in _remove_duplicates(graph_order.split())
            if field in fields]
        category = info.pop('graph_category', '')
        if category:
            info['category'] = category.lower()
    return data


def _get_rrd_files(group, host, graph):
    """Return a list of RRD files that are available for the graph."""
    files = os.listdir(os.path.join(MUNIN_DBDIR, group))
    prefix = '%s-%s-' % (host, graph)
    return sorted(
        f for f in files
        if f.startswith(prefix) and f.endswith('.rrd'))


def _fetch_rrd(filename, start, end, resolution=300, cf='AVERAGE'):
    """Use rrdtool to fetch values to the data."""
    output = subprocess.check_output([
        'rrdtool', 'fetch', os.path.join(MUNIN_DBDIR, filename),
        cf, '-r', str(resolution), '-s', str(start), '-e', str(end)])
    for line in output.decode('utf-8').splitlines():
        if ':' in line:
            try:
                time, value = line.split(':', 1)
                value = float(value)
                if not math.isnan(value):
                    yield int(time), value
            except ValueError:
                pass


def get_raw_values(group, host, graph, start, end, resolution=300, minmax=True):
    """Get the data points available from the specified graph."""
    start = int(start / resolution) * resolution
    end = int(end / resolution) * resolution
    data = defaultdict(defaultdict)
    for f in _get_rrd_files(group, host, graph):
        field = '-'.join(f.split('-')[2:-1])
        filename = os.path.join(group, f)
        for time_, value in _fetch_rrd(filename, start, end, resolution, 'AVERAGE'):
            data[time_][field] = value
        if minmax:
            for time_, value in _fetch_rrd(filename, start, end, resolution, 'MIN'):
                data[time_][field + '.min'] = value
            for time_, value in _fetch_rrd(filename, start, end, resolution, 'MAX'):
                data[time_][field + '.max'] = value
    return [dict(time=k, **v) for k, v in sorted(data.items())]


cdef_ops = {
    '+': (lambda a, b: a + b),
    '-': (lambda a, b: a - b),
    '*': (lambda a, b: a * b),
    '/': (lambda a, b: a / b),
}

cdef_number_re = re.compile(r'^-?[0-9]+(\.[0-9]*)?$')


def cdef_eval(expression, row, suffix=''):
    """Evaluate a cdef expression using variables from row."""
    tokens = expression.split(',')
    stack = []
    for token in tokens:
        if cdef_number_re.match(token):
            stack.append(float(token))
        elif token in cdef_ops:
            arg2 = stack.pop()
            arg1 = stack.pop()
            result = cdef_ops[token](arg1, arg2)
            stack.append(result)
        else:
            stack.append(row[token + suffix])
    return stack.pop()


def get_values(group, host, graph, start, end, resolution=300, minmax=True):
    """Get the data points available from the specified graph."""
    graph_info = get_info()['%s/%s/%s' % (group, host, graph)]
    data = get_raw_values(group, host, graph, start, end, resolution, minmax)
    for field_info in graph_info['fields']:
        negative = field_info.get('negative')
        if negative:
            for row in data:
                try:
                    values = [
                        -row[negative + '.min'],
                        -row[negative],
                        -row[negative + '.max']]
                    (
                        row[negative + '.min'],
                        row[negative],
                        row[negative + '.max'],
                    ) = sorted(values)
                except KeyError:
                    pass
        cdef = field_info.get('cdef')
        if cdef:
            field = field_info['name']
            for row in data:
                try:
                    values = [
                        cdef_eval(cdef, row, '.min'),
                        cdef_eval(cdef, row),
                        cdef_eval(cdef, row, '.max')]
                    row[field + '.min'], row[field], row[field + '.max'] = sorted(values)
                except Exception:
                    pass
    return data


def get_resolutions(group, host, graph):
    """Return a list of resolutions available for the graph."""
    # find the newest file
    rrdfile = sorted(
        (os.stat(x).st_mtime, x) for x in (
            os.path.join(MUNIN_DBDIR, group, y)
            for y in _get_rrd_files(group, host, graph)))[-1][1]
    output = subprocess.check_output(['rrdtool', 'info', rrdfile])
    resolutions = {}
    rows = {}
    for line in output.decode('utf-8').splitlines():
        if line.startswith('step = '):
            # the measurement resolution
            step = int(line.split(' = ')[1])
        elif line.startswith('last_update = '):
            last_update = int(line.split(' = ')[1])
            last_update = int(last_update / step) * step
        elif '.pdp_per_row = ' in line:
            pdp_per_row = int(line.split(' = ')[1])
            resolutions[pdp_per_row * step] = line.split('.')[0]
        elif '.rows = ' in line:
            rows[line.split('.')[0]] = int(line.split(' = ')[1])
    return last_update, [(r, rows[i]) for r, i in sorted(resolutions.items())]
