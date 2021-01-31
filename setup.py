#!/usr/bin/env python3

# Copyright (C) 2019-2021 Arthur de Jong
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

"""munin-plot installation script."""

import os
import subprocess
import sys
from distutils.spawn import find_executable

from setuptools import setup
from setuptools.command.build_py import build_py
from setuptools.command.sdist import sdist


# fix permissions for sdist
if 'sdist' in sys.argv:
    os.system('chmod -R a+rX .')
    os.umask(int('022', 8))


def build_npm():
    """Build the static files by using NPM."""
    # build static files if NPM can be found
    if find_executable('npm'):
        subprocess.run(['npm', 'install'], check=True)
        subprocess.run(['npm', 'run', 'build'], check=True)
    # fail if generated files are absent
    with open('muninplot/static/index.html', 'rb') as f:
        f.read()


class NPMbuild_py(build_py):  # noqa: N801
    """Custom build class to build static files with NPM."""

    def run(self):
        """Perform the sdist actions."""
        build_npm()
        build_py.run(self)


class NPMsdist(sdist):
    """Custom sdist class to build static files with NPM."""

    def run(self):
        """Perform the sdist actions."""
        build_npm()
        sdist.run(self)


setup(
    cmdclass={
        'build_py': NPMbuild_py,
        'sdist': NPMsdist,
    },
)
