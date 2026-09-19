// Exercise engine-style workers, SDL rendering, and the virtual-save path.
#define SDL_MAIN_HANDLED
#include <SDL2/SDL.h>
#include <emscripten.h>
#include <cstdio>
#include <fstream>
#include <string>
#include <thread>
#include <atomic>

int main() {
    std::string text;
    // Engine task workers must be usable while SDL stays on the browser thread.
    std::atomic<bool> finished{false};
    std::thread task([&]() { text = "worker-task-completed"; finished = true; });
    while(!finished) emscripten_sleep(1);
    task.join();
    if(text != "worker-task-completed") return 2;
    std::ifstream input("/save/input.txt");
    std::getline(input, text);
    if(text != "browser-to-worker") return 6;
    if(SDL_Init(SDL_INIT_VIDEO) < 0) {
        std::printf("SDL init: %s\n", SDL_GetError()); return 3;
    }
    auto* window = SDL_CreateWindow("Runtime probe", 0, 0, 640, 360, 0);
    if(!window) { std::printf("Window: %s\n", SDL_GetError()); return 4; }
    auto* renderer = SDL_CreateRenderer(window, -1, SDL_RENDERER_ACCELERATED);
    if(!renderer) { std::printf("Renderer: %s\n", SDL_GetError()); return 5; }
    SDL_SetRenderDrawColor(renderer, 30, 110, 90, 255);
    SDL_RenderClear(renderer);
    SDL_Rect rectangle{80, 70, 480, 220};
    SDL_SetRenderDrawColor(renderer, 220, 190, 95, 255);
    SDL_RenderFillRect(renderer, &rectangle);
    unsigned char pixel[4]{};
    SDL_Rect sample{100, 100, 1, 1};
    if(SDL_RenderReadPixels(renderer, &sample, SDL_PIXELFORMAT_RGBA32, pixel, 4) != 0 ||
       pixel[0] != 220 || pixel[1] != 190 || pixel[2] != 95) return 7;
    SDL_RenderPresent(renderer);
    MAIN_THREAD_EM_ASM({ Module['probeFrame'] = true; });
    emscripten_sleep(250);
    std::ofstream output("/save/output.txt");
    output << "worker-to-browser";
    output.close();
    SDL_DestroyRenderer(renderer);
    SDL_DestroyWindow(window);
    SDL_Quit();
    return 0;
}
