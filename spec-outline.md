We want to make a single-webpage tool for training the approximate number system (ANS), or the skill of estimating the magnitude of a group from an image without consciously counting or calculating.
This is currently an empty repo besides this README.md file which just outlines the idea.

I'm imagining the flow like this:
* Page opens with description, difficulty/tolerance input (default say 20%), and a "play" button.
* Pressing play changes it to show a full-screen canvas display with a bunch of dots on it.
* Player enters a number and presses enter. This is their guess for how many dots are present.
* We immediately transition to a new display, as well as a message - show their last guess, the last true value, and success/failure dependent on whether they got within 20% or the tolerance they set.
* Continue showing new canvases until they press escape or "X" button, which goes back to intro screen.

For the canvas display, we should select the number (say 20 to 2000), and randomly select a symbol, color / color range, and arrangement. The goal of this is to ensure generalization of the skill.

For symbols, we could use circles, triangles, squares, "X" symbols, short lines, or potentially unicode characters. We randomly choose the color and per-symbol color variation (for example we could use all colors of the rainbow, or make all the symbols the same fixed color, or use a small range (say green to blue); similarly the background color should be randomly either black or white, but we should ensure all symbols are visible against the background. So probably if the background is white, symbols must be black or random HSV with some hue range and fixed value V. If the background is black, our options are the same except we allow white and disallow black.

For the arrangement, we want to avoid placing symbols directly overlapping each other. So I think some patterns that could work:
* Regular grid (either occupying the full canvas, or some rectangular part of it)
* Regular grid with some missing
* Randomly scattered in a way that avoids overlaps - maybe create a grid and place a symbol at a random position inside each grid cell, or some fraction of them
* Some kind of circular arrangement - maybe along Archimedes spiral, with some spots filled and others left empty

