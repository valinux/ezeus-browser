// Integration check against the actual eZeus XML parser, without SDL/windowing.
#include "exmlparser.h"
#include <iostream>

int main(int argc, char** argv) {
    if (argc != 3) return 2;
    eTextStrings text;
    eMMStrings messages;
    if (!eXmlParser::sParse(text, argv[1]) || !eXmlParser::sParse(messages, argv[2])) return 1;
    size_t strings = 0;
    size_t titles = 0;
    size_t contents = 0;
    for (const auto& group : text) strings += group.second.size();
    for (const auto& entry : messages) {
        titles += !entry.second.fTitle.empty();
        contents += !entry.second.fContent.empty();
    }
    std::cout << "{\"groups\":" << text.size()
              << ",\"strings\":" << strings
              << ",\"messages\":" << messages.size()
              << ",\"titles\":" << titles
              << ",\"contents\":" << contents << "}\n";
    return text.empty() || messages.empty();
}
