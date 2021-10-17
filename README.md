munin-plot
==========

This is an alternative web front-end for Munin. It provides more dynamic
graphs while trying to maintain the Munin feature set.

This is very much work in progress (suggestions for a better name are
welcome) but it should be reasonably usable already.

It consist of a Python web service that exposes the Munin configuration as
JSON and data as CSV and a JavaScript application that plots the information.

https://arthurdejong.org/munin-plot/

Deploying under Apache with mod_wsgi
------------------------------------

Basic configuration snippet for deploying the munin-plot under Apache with
mod_wsgi:

    WSGIDaemonProcess munin-plot threads=5 maximum-requests=100 display-name=%{GROUP} home=/PATH/TO/munin-plot
    AliasMatch ^/munin-plot/(graphs.*|data.*|dashboards)$ /PATH/TO/munin-plot/muninplot/wsgi.py/$1
    Alias /munin-plot /PATH/TO/munin-plot/static
    <Directory /PATH/TO/munin-plot>
      <Files web.py>
        Options ExecCGI
        SetHandler wsgi-script
        SetEnv DASHBOARDS_DIR /PATH/TO/dashboards
        WSGIProcessGroup munin-plot
      </Files>
      Header always set Content-Security-Policy "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-eval'; frame-ancestors 'none'"
    </Directory>

Copyright
---------

Copyright (C) 2018-2021 Arthur de Jong

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
