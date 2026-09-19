# ENG converter format implementation

`convert_eng.py` adapts the binary layout and XML conventions from the EngConverter component of [citybuilding-tools](https://github.com/bvschaik/citybuilding-tools), particularly `textfileengstream.cpp`, `messagefileengstream.cpp`, and their XML writers. The implementation is a Python command-line adaptation with additional input validation. It currently targets Zeus text/message files and defaults to Western Windows-1252 text. It does not bundle game content or implement the upstream custom East Asian codecs.

The upstream permission notice follows:

Copyright (c) 2017 Bianca van Schaik <bvschaik@gmail.com>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
