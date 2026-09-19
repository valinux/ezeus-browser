#ifndef EBROWSERLAYOUT_H
#define EBROWSERLAYOUT_H

// Browser-only reflow keeps existing widgets, callbacks, and open dialogs alive.
// Resizing a window must not recreate a city or dismiss a pending game decision.
#include "ewidget.h"
#include <unordered_map>

namespace eBrowserLayout {
inline auto& alignments() {
    static std::unordered_map<const eWidget*, eAlignment> values;
    return values;
}

inline void remember(const eWidget* widget, const eAlignment alignment) {
    const int horizontal = int(eAlignment::left) | int(eAlignment::right) | int(eAlignment::hcenter);
    const int vertical = int(eAlignment::top) | int(eAlignment::bottom) | int(eAlignment::vcenter);
    int old = int(alignments()[widget]);
    const int value = int(alignment);
    if(value & horizontal) old = (old & ~horizontal) | (value & horizontal);
    if(value & vertical) old = (old & ~vertical) | (value & vertical);
    alignments()[widget] = static_cast<eAlignment>(old);
}

inline void forget(const eWidget* widget) { alignments().erase(widget); }

inline void resize(eWidget* widget, const int width, const int height) {
    const int oldWidth = widget->width();
    const int oldHeight = widget->height();
    const int dx = width - oldWidth;
    const int dy = height - oldHeight;
    if(!dx && !dy) return;
    widget->resize(width, height);
    for(const auto child : widget->children()) {
        // Modal backdrops continue to cover the entire parent and receive clicks.
        if(child->x() == 0 && child->y() == 0 &&
           child->width() == oldWidth && child->height() == oldHeight) {
            resize(child, width, height);
            continue;
        }
        const auto found = alignments().find(child);
        const auto a = found == alignments().end() ? static_cast<eAlignment>(0) : found->second;
        const auto has = [a](eAlignment flag) { return bool(a & flag); };
        // Unanchored root content (including dialogs positioned around the city
        // view) follows the center. Explicit edge anchors preserve their margin.
        const int moveX = has(eAlignment::left) ? 0 : has(eAlignment::right) ? dx : dx/2;
        const int moveY = has(eAlignment::top) ? 0 : has(eAlignment::bottom) ? dy : dy/2;
        child->move(child->x() + moveX, child->y() + moveY);
    }
}
}

#endif
