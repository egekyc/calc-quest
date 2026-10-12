# Calc Quest 

A pixel-art calculator puzzle. You get a **target number**, a set of **operations** and a **number count**. Type a sum on the calculator that hits the target. It's plain HTML, CSS and JavaScript, so there's no build step. It runs on GitHub Pages and is played in a desktop browser.

## 1. How to play

- Every number you type is a single digit, **1 to 9**.
- Use **exactly** the number count shown.
- Use **every** operation shown at least once, and no others.
- The answer is checked as soon as you type the last number. Any correct answer counts, not just the one the game had in mind.

Each round has 10 puzzles. A solved puzzle is worth 100 points, plus up to 50 for speed. A hint costs 50 points, and skipping scores 0 but shows you one answer. Your best score for each level is saved in the browser.

## 2. Controls

| Action | Keyboard | Screen |
|---|---|---|
| Type a number | 1–9 | Keypad |
| Operations | `+` `-` `*` (or `x`) `/` | Keypad |
| Delete last | Backspace | DEL |
| Clear | Esc | CLR |
| Check / next puzzle | Enter | OK / NEXT |

All numbers and operation symbols are drawn as SVG on a 5×7 pixel grid, the classic calculator look, so they stay sharp and easy to read at every size. The rest of the text uses the Press Start 2P pixel font. See [`js/pixel-num.js`](js/pixel-num.js).

## 3. License

[MIT](LICENSE)
