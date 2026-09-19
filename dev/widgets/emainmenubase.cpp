#include "emainmenubase.h"

#include "textures/egametextures.h"
#ifdef __EMSCRIPTEN__
#include <algorithm>
#include <cmath>
#endif

void eMainMenuBase::initialize() {
    const auto& intrfc = eGameTextures::interface();
    const auto res = resolution();
    const int iRes = static_cast<int>(res.uiScale());
    const auto& texs = intrfc[iRes];
    setTexture(texs.fMainMenuImage);
}

#ifdef __EMSCRIPTEN__
void eMainMenuBase::paintEvent(ePainter& p) {
    const auto& tex = texture();
    if(!tex || tex->width() <= 0 || tex->height() <= 0) return;

    // Fill the same viewport as the city. Only the background is cropped;
    // controls keep their normal proportions, positions, and mouse targets.
    const double scale = std::max(double(width())/tex->width(),
                                  double(height())/tex->height());
    const int drawWidth = std::ceil(tex->width()*scale);
    const int drawHeight = std::ceil(tex->height()*scale);
    const SDL_Rect source{tex->x(), tex->y(), tex->width(), tex->height()};
    const SDL_Rect destination{p.x() + (width() - drawWidth)/2,
                               p.y() + (height() - drawHeight)/2,
                               drawWidth, drawHeight};
    tex->render(p.renderer(), source, destination);
}
#endif
