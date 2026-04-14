// 스도쿠 게임 앱
const App = (() => {
    // 게임 상태
    let state = {
        puzzle: null,
        solution: null,
        board: null,       // 현재 보드 상태
        notes: null,       // 메모 (9x9 배열, 각 셀은 Set)
        given: null,       // 초기 제공된 셀
        selected: null,    // { row, col }
        mistakes: 0,
        maxMistakes: 3,
        hintsLeft: 3,
        notesMode: false,
        history: [],       // undo 스택
        timer: 0,
        timerInterval: null,
        difficulty: 'advanced',
        gameOver: false,
    };

    // DOM 요소
    const dom = {};

    function init() {
        cacheDom();
        bindEvents();
        newGame();
    }

    function cacheDom() {
        dom.board = document.getElementById('board');
        dom.mistakes = document.getElementById('mistakes');
        dom.timer = document.getElementById('timer');
        dom.hintsLeft = document.getElementById('hints-left');
        dom.progress = document.getElementById('progress');
        dom.btnUndo = document.getElementById('btn-undo');
        dom.btnErase = document.getElementById('btn-erase');
        dom.btnNotes = document.getElementById('btn-notes');
        dom.btnHint = document.getElementById('btn-hint');
        dom.btnNewGame = document.getElementById('btn-new-game');
        dom.modalGameover = document.getElementById('modal-gameover');
        dom.modalComplete = document.getElementById('modal-complete');
        dom.completeMsg = document.getElementById('complete-msg');
        dom.btnRetry = document.getElementById('btn-retry');
        dom.btnNewAfterWin = document.getElementById('btn-new-after-win');
        dom.loadingOverlay = document.getElementById('loading-overlay');
        dom.tabs = document.querySelectorAll('.tab');
        dom.numBtns = document.querySelectorAll('.num-btn');
    }

    function bindEvents() {
        dom.board.addEventListener('click', onCellClick);
        dom.btnUndo.addEventListener('click', undo);
        dom.btnErase.addEventListener('click', erase);
        dom.btnNotes.addEventListener('click', toggleNotesMode);
        dom.btnHint.addEventListener('click', useHint);
        dom.btnNewGame.addEventListener('click', newGame);
        dom.btnRetry.addEventListener('click', newGame);
        dom.btnNewAfterWin.addEventListener('click', newGame);

        dom.tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                dom.tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                state.difficulty = tab.dataset.difficulty === 'expert' ? 'expert' : 'advanced';
                newGame();
            });
        });

        dom.numBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const num = parseInt(btn.dataset.num);
                inputNumber(num);
            });
        });

        // 키보드 입력
        document.addEventListener('keydown', (e) => {
            if (state.gameOver) return;
            const num = parseInt(e.key);
            if (num >= 1 && num <= 9) {
                inputNumber(num);
            } else if (e.key === 'Backspace' || e.key === 'Delete') {
                erase();
            } else if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
                undo();
            } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown' ||
                       e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                moveSelection(e.key);
                e.preventDefault();
            }
        });
    }

    function newGame() {
        // 모달 닫기
        dom.modalGameover.classList.remove('show');
        dom.modalComplete.classList.remove('show');

        // 로딩 표시
        dom.loadingOverlay.classList.add('show');

        // 타이머 리셋
        if (state.timerInterval) clearInterval(state.timerInterval);

        // 비동기로 퍼즐 생성 (UI 블로킹 방지)
        setTimeout(() => {
            const { puzzle, solution } = SudokuEngine.generatePuzzle(state.difficulty);

            state.puzzle = puzzle;
            state.solution = solution;
            state.board = puzzle.map(row => [...row]);
            state.notes = Array.from({ length: 9 }, () =>
                Array.from({ length: 9 }, () => new Set())
            );
            state.given = puzzle.map(row => row.map(v => v !== 0));
            state.selected = null;
            state.mistakes = 0;
            state.hintsLeft = 3;
            state.notesMode = false;
            state.history = [];
            state.timer = 0;
            state.gameOver = false;

            dom.btnNotes.dataset.active = 'false';

            renderBoard();
            updateStatus();
            startTimer();

            dom.loadingOverlay.classList.remove('show');
        }, 50);
    }

    function renderBoard() {
        dom.board.innerHTML = '';
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.dataset.row = row;
                cell.dataset.col = col;

                if (state.given[row][col]) {
                    cell.classList.add('given');
                    cell.textContent = state.board[row][col];
                } else if (state.board[row][col] !== 0) {
                    cell.classList.add('filled');
                    cell.textContent = state.board[row][col];
                    if (state.board[row][col] !== state.solution[row][col]) {
                        cell.classList.add('error');
                    }
                } else if (state.notes[row][col].size > 0) {
                    const notesDiv = document.createElement('div');
                    notesDiv.className = 'notes';
                    for (let n = 1; n <= 9; n++) {
                        const span = document.createElement('span');
                        span.textContent = state.notes[row][col].has(n) ? n : '';
                        notesDiv.appendChild(span);
                    }
                    cell.appendChild(notesDiv);
                }

                dom.board.appendChild(cell);
            }
        }
        updateHighlights();
        updateNumpadCompletion();
    }

    function onCellClick(e) {
        if (state.gameOver) return;
        const cell = e.target.closest('.cell');
        if (!cell) return;

        const row = parseInt(cell.dataset.row);
        const col = parseInt(cell.dataset.col);
        state.selected = { row, col };
        updateHighlights();
    }

    function updateHighlights() {
        const cells = dom.board.querySelectorAll('.cell');
        cells.forEach(cell => {
            cell.classList.remove('selected', 'highlighted', 'same-number');
        });

        if (!state.selected) return;
        const { row: sr, col: sc } = state.selected;
        const selectedVal = state.board[sr][sc];
        const boxRow = Math.floor(sr / 3) * 3;
        const boxCol = Math.floor(sc / 3) * 3;

        cells.forEach(cell => {
            const r = parseInt(cell.dataset.row);
            const c = parseInt(cell.dataset.col);

            if (r === sr && c === sc) {
                cell.classList.add('selected');
            } else if (r === sr || c === sc ||
                (r >= boxRow && r < boxRow + 3 && c >= boxCol && c < boxCol + 3)) {
                cell.classList.add('highlighted');
            }

            if (selectedVal !== 0 && state.board[r][c] === selectedVal && !(r === sr && c === sc)) {
                cell.classList.add('same-number');
            }
        });
    }

    function inputNumber(num) {
        if (state.gameOver || !state.selected) return;
        const { row, col } = state.selected;
        if (state.given[row][col]) return;

        if (state.notesMode) {
            // 메모 모드
            const prevNotes = new Set(state.notes[row][col]);
            state.history.push({ type: 'notes', row, col, prevNotes, prevValue: state.board[row][col] });

            if (state.board[row][col] !== 0) {
                state.board[row][col] = 0;
            }

            if (state.notes[row][col].has(num)) {
                state.notes[row][col].delete(num);
            } else {
                state.notes[row][col].add(num);
            }
        } else {
            // 일반 입력 모드
            const prevValue = state.board[row][col];
            const prevNotes = new Set(state.notes[row][col]);
            state.history.push({ type: 'input', row, col, prevValue, prevNotes });

            state.board[row][col] = num;
            state.notes[row][col].clear();

            // 오답 체크
            if (num !== state.solution[row][col]) {
                state.mistakes++;
                if (state.mistakes >= state.maxMistakes) {
                    state.gameOver = true;
                    renderBoard();
                    updateStatus();
                    setTimeout(() => showGameOver(), 500);
                    return;
                }
            } else {
                // 같은 행/열/박스의 메모에서 해당 숫자 자동 제거
                removeRelatedNotes(row, col, num);
            }

            // 완료 체크
            if (checkComplete()) {
                state.gameOver = true;
                renderBoard();
                updateStatus();
                setTimeout(() => showComplete(), 500);
                return;
            }
        }

        renderBoard();
        updateStatus();
    }

    function removeRelatedNotes(row, col, num) {
        const boxRow = Math.floor(row / 3) * 3;
        const boxCol = Math.floor(col / 3) * 3;

        for (let i = 0; i < 9; i++) {
            state.notes[row][i].delete(num);
            state.notes[i][col].delete(num);
        }
        for (let r = boxRow; r < boxRow + 3; r++) {
            for (let c = boxCol; c < boxCol + 3; c++) {
                state.notes[r][c].delete(num);
            }
        }
    }

    function erase() {
        if (state.gameOver || !state.selected) return;
        const { row, col } = state.selected;
        if (state.given[row][col]) return;

        if (state.board[row][col] !== 0 || state.notes[row][col].size > 0) {
            state.history.push({
                type: 'erase',
                row, col,
                prevValue: state.board[row][col],
                prevNotes: new Set(state.notes[row][col])
            });
            state.board[row][col] = 0;
            state.notes[row][col].clear();
            renderBoard();
            updateStatus();
        }
    }

    function undo() {
        if (state.gameOver || state.history.length === 0) return;
        const action = state.history.pop();
        const { row, col, prevValue, prevNotes } = action;

        state.board[row][col] = prevValue;
        state.notes[row][col] = prevNotes;
        state.selected = { row, col };

        renderBoard();
        updateStatus();
    }

    function toggleNotesMode() {
        state.notesMode = !state.notesMode;
        dom.btnNotes.dataset.active = state.notesMode ? 'true' : 'false';
    }

    function useHint() {
        if (state.gameOver || state.hintsLeft <= 0) return;

        // 선택된 셀이 비어있으면 그곳에 힌트, 아니면 랜덤 빈 셀
        let targetRow, targetCol;

        if (state.selected && !state.given[state.selected.row][state.selected.col]
            && state.board[state.selected.row][state.selected.col] === 0) {
            targetRow = state.selected.row;
            targetCol = state.selected.col;
        } else {
            const emptyCells = [];
            for (let r = 0; r < 9; r++) {
                for (let c = 0; c < 9; c++) {
                    if (state.board[r][c] === 0) emptyCells.push([r, c]);
                }
            }
            if (emptyCells.length === 0) return;
            const [r, c] = emptyCells[Math.floor(Math.random() * emptyCells.length)];
            targetRow = r;
            targetCol = c;
        }

        state.hintsLeft--;
        state.history.push({
            type: 'hint',
            row: targetRow,
            col: targetCol,
            prevValue: state.board[targetRow][targetCol],
            prevNotes: new Set(state.notes[targetRow][targetCol])
        });

        state.board[targetRow][targetCol] = state.solution[targetRow][targetCol];
        state.notes[targetRow][targetCol].clear();
        state.selected = { row: targetRow, col: targetCol };

        removeRelatedNotes(targetRow, targetCol, state.solution[targetRow][targetCol]);

        renderBoard();
        updateStatus();

        // 힌트 애니메이션
        const cellEl = dom.board.querySelector(
            `.cell[data-row="${targetRow}"][data-col="${targetCol}"]`
        );
        if (cellEl) cellEl.classList.add('hint-reveal');

        if (checkComplete()) {
            state.gameOver = true;
            setTimeout(() => showComplete(), 600);
        }
    }

    function checkComplete() {
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                if (state.board[r][c] !== state.solution[r][c]) return false;
            }
        }
        return true;
    }

    function moveSelection(key) {
        if (!state.selected) {
            state.selected = { row: 0, col: 0 };
        } else {
            let { row, col } = state.selected;
            if (key === 'ArrowUp') row = Math.max(0, row - 1);
            if (key === 'ArrowDown') row = Math.min(8, row + 1);
            if (key === 'ArrowLeft') col = Math.max(0, col - 1);
            if (key === 'ArrowRight') col = Math.min(8, col + 1);
            state.selected = { row, col };
        }
        updateHighlights();
    }

    function updateStatus() {
        dom.mistakes.textContent = `${state.mistakes}/${state.maxMistakes}`;
        dom.hintsLeft.textContent = state.hintsLeft;

        // 진행률
        let filled = 0;
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                if (state.board[r][c] !== 0 && state.board[r][c] === state.solution[r][c]) filled++;
            }
        }
        dom.progress.textContent = Math.round((filled / 81) * 100) + '%';
    }

    function updateNumpadCompletion() {
        const count = Array(10).fill(0);
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                const v = state.board[r][c];
                if (v !== 0 && v === state.solution[r][c]) count[v]++;
            }
        }
        dom.numBtns.forEach(btn => {
            const num = parseInt(btn.dataset.num);
            btn.classList.toggle('completed', count[num] >= 9);
        });
    }

    function startTimer() {
        if (state.timerInterval) clearInterval(state.timerInterval);
        state.timer = 0;
        dom.timer.textContent = '00:00';
        state.timerInterval = setInterval(() => {
            if (state.gameOver) return;
            state.timer++;
            const min = String(Math.floor(state.timer / 60)).padStart(2, '0');
            const sec = String(state.timer % 60).padStart(2, '0');
            dom.timer.textContent = `${min}:${sec}`;
        }, 1000);
    }

    function showGameOver() {
        if (state.timerInterval) clearInterval(state.timerInterval);
        dom.modalGameover.classList.add('show');
    }

    function showComplete() {
        if (state.timerInterval) clearInterval(state.timerInterval);
        const min = Math.floor(state.timer / 60);
        const sec = state.timer % 60;
        const diffName = state.difficulty === 'expert' ? '최고급' : '고급';
        dom.completeMsg.textContent =
            `${diffName} 난이도를 ${min}분 ${sec}초만에 완료했습니다!`;
        dom.modalComplete.classList.add('show');
    }

    // 페이지 로드 시 시작
    document.addEventListener('DOMContentLoaded', init);
})();
