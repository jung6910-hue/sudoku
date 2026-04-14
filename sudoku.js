// 스도쿠 퍼즐 생성 엔진
const SudokuEngine = (() => {
    function shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    function isValid(grid, row, col, num) {
        for (let i = 0; i < 9; i++) {
            if (grid[row][i] === num || grid[i][col] === num) return false;
        }
        const br = Math.floor(row / 3) * 3;
        const bc = Math.floor(col / 3) * 3;
        for (let r = br; r < br + 3; r++) {
            for (let c = bc; c < bc + 3; c++) {
                if (grid[r][c] === num) return false;
            }
        }
        return true;
    }

    function solveShuffle(grid) {
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                if (grid[row][col] === 0) {
                    const nums = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
                    for (const num of nums) {
                        if (isValid(grid, row, col, num)) {
                            grid[row][col] = num;
                            if (solveShuffle(grid)) return true;
                            grid[row][col] = 0;
                        }
                    }
                    return false;
                }
            }
        }
        return true;
    }

    // 해가 2개 이상인지 빠르게 판별 (제한 횟수 내에서만)
    function hasUniqueSolution(grid) {
        let count = 0;
        const MAX_ITER = 50000;
        let iter = 0;

        function solve(g) {
            if (count >= 2 || iter >= MAX_ITER) return;
            iter++;
            for (let row = 0; row < 9; row++) {
                for (let col = 0; col < 9; col++) {
                    if (g[row][col] === 0) {
                        for (let num = 1; num <= 9; num++) {
                            if (isValid(g, row, col, num)) {
                                g[row][col] = num;
                                solve(g);
                                if (count >= 2 || iter >= MAX_ITER) {
                                    g[row][col] = 0;
                                    return;
                                }
                                g[row][col] = 0;
                            }
                        }
                        return;
                    }
                }
            }
            count++;
        }

        solve(grid);
        return count === 1;
    }

    function generateComplete() {
        const grid = Array.from({ length: 9 }, () => Array(9).fill(0));
        solveShuffle(grid);
        return grid;
    }

    function generatePuzzle(difficulty) {
        const solution = generateComplete();
        const puzzle = solution.map(row => [...row]);

        const target = difficulty === 'expert'
            ? 53 + Math.floor(Math.random() * 4)   // 최고급: 53~56
            : 45 + Math.floor(Math.random() * 4);   // 고급: 45~48

        const positions = shuffle(
            Array.from({ length: 81 }, (_, i) => [Math.floor(i / 9), i % 9])
        );

        let removed = 0;
        for (const [row, col] of positions) {
            if (removed >= target) break;
            const backup = puzzle[row][col];
            puzzle[row][col] = 0;

            const copy = puzzle.map(r => [...r]);
            if (hasUniqueSolution(copy)) {
                removed++;
            } else {
                puzzle[row][col] = backup;
            }
        }

        return { puzzle, solution };
    }

    return { generatePuzzle };
})();
