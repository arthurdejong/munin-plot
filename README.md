munin-plot
==========

This is an alternative web front-end for Munin. It provides dynamic graphs
while trying to maintain the Munin feature set. This is very much work in
progress but it should be reasonably usable already.

It consist of a Python web service that exposes the Munin configuration as
JSON and data as CSV and a JavaScript application that plots the information.

https://arthurdejong.org/munin-plot/

Installing munin-plot
---------------------

The Python web service can be installed in a Python 3 virtualenv on the same
machine that runs the Munin web interface:

    $ virtualenv --python python3 /PATH/TO/munin-plot
    $ /PATH/TO/munin-plot/bin/pip install munin-plot

The web service should be deployed in a WSGI server such as uWSGI or Apache
mod_wsgi.

Example configuration snippet for deploying under Apache with mod_wsgi:

    WSGIDaemonProcess munin-plot threads=5 maximum-requests=100 display-name=%{GROUP} python-home=/PATH/TO/munin-plot
    AliasMatch ^/munin-plot/(graphs.*|data.*|dashboards)$ /PATH/TO/munin-plot/lib/python3.7/site-packages/muninplot/wsgi.py/$1
    Alias /munin-plot /PATH/TO/munin-plot/lib/python3.7/site-packages/muninplot/static
    <Directory /PATH/TO/munin-plot/lib/python3.7/site-packages/muninplot>
      <Files wsgi.py>
        Options ExecCGI
        SetHandler wsgi-script
        SetEnv DASHBOARDS_DIR /PATH/TO/munin-plot/dashboards
        WSGIProcessGroup munin-plot
      </Files>
      Header always set Content-Security-Policy "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-eval'; frame-ancestors 'none'"
    </Directory>


Configuring munin-plot
----------------------

Environment variables are used to configure the web service.

``MUNIN_DBDIR``
: The directory (by default /var/lib/munin) that holds the Munin data files
(i.e. ``datafile`` and ``.rrd`` files in sub directories).

``DASHBOARDS_DIR``:
: A directory that contains JSON dashboard definitions. Dashboards can be
exported from munin-plot and be manually copied to this directory.


Copyright
---------

Copyright (C) 2018-2022 Arthur de Jong

Permission is hereby granted, free of charge, to any person obtaining a
copy of this software and associated documentation files (the "Software"),
to deal in the Software without restriction, including without limitation
the rights to use, copy, modify, merge, publish, distribute, sublicense,
and/or sell copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
DEALINGS IN THE SOFTWARE.
