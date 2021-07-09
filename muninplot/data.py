# Copyright (C) 2018-2021 Arthur de Jong
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

import json
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
                fields[negative].setdefault('is_negative', True)
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


def _cdef_change(cdef, mod):
    """Replace references in the cdef expression to include min and max."""
    return ','.join(x + mod if re.match('^[a-z_][a-z0-9_]*$', x) else x for x in cdef.split(','))


def _key(value):
    """For sorting None values consistently."""
    return 0 if value is None else value


def get_values(group, host, graph, start, end):
    """Get the data points available from the specified graph."""
    graph_info = get_info()['%s/%s/%s' % (group, host, graph)]
    columns = ['time']
    # build command line
    cmd = [
        'rrdtool', 'xport', '-s', str(int(start)), '-e', str(int(end)), '--json']
    # add fields to command line
    for field_info in graph_info['fields']:
        field = field_info['name']
        columns += [field + '.min', field, field + '.max']
        # fetch the values from the RRD file
        rrdfile = os.path.join(
            MUNIN_DBDIR, group,
            '%s-%s-%s-%s.rrd' % (host, graph, field, field_info.get('type', 'g')[0].lower()))
        cmd += [
            'DEF:%s_min=%s:42:MIN' % (field, rrdfile),
            'DEF:%s_avg=%s:42:AVERAGE' % (field, rrdfile),
            'DEF:%s_max=%s:42:MAX' % (field, rrdfile)]
        # translate the field values with CDEF expressions if defined
        cdef = field_info.get('cdef')
        if cdef:
            cmd += [
                'CDEF:%s_cdef_min=%s' % (field, _cdef_change(cdef, '_min')),
                'CDEF:%s_cdef_avg=%s' % (field, _cdef_change(cdef, '_avg')),
                'CDEF:%s_cdef_max=%s' % (field, _cdef_change(cdef, '_max'))]
            field = field + '_cdef'
        # negative is a new field that is the negative of another field
        # for negative we transform the field referenced by negative
        if field_info.get('is_negative'):
            cmd += [
                'CDEF:%s_neg_min=%s_max,-1,*' % (field, field),
                'CDEF:%s_neg_avg=%s_avg,-1,*' % (field, field),
                'CDEF:%s_neg_max=%s_min,-1,*' % (field, field)]
            field = field + '_neg'
        # output the resulting fields
        cmd += [
            'XPORT:%s_min' % field,
            'XPORT:%s_avg' % field,
            'XPORT:%s_max' % field]
    # run the command
    data = json.loads(subprocess.check_output(cmd))
    timestamp = data['meta']['start']
    step = data['meta']['step']
    yield columns
    for values in data['data']:
        # re-order the values in groups of 3 to have min, average and max correct
        yield [timestamp] + sum(
            (sorted(values[i:i + 3], key=_key) for i in range(0, len(values), 3)),
            [])
        timestamp += step
