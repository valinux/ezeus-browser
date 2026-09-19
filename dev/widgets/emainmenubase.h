#ifndef EMAINMENUBASE_H
#define EMAINMENUBASE_H

#include "elabel.h"

class eMainMenuBase : public eLabel {
public:
    using eLabel::eLabel;

    void initialize();
#ifdef __EMSCRIPTEN__
protected:
    void paintEvent(ePainter& p) override;
#endif
};

#endif // EMAINMENUBASE_H
