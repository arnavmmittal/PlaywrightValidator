# Lessons Learned

## 2026-03-03: Initial Project Setup

### What Worked Well
- Breaking the project into clear phases with commits at each stage
- Using the spec document as a reference throughout
- Parallel creation of test modules to speed up development

### Technical Decisions
- **Playwright over Puppeteer**: Chosen for better cross-browser support and modern API
- **Express + ws**: Simple, well-supported WebSocket implementation
- **Tailwind CSS v4**: Used @tailwindcss/vite plugin for modern integration
- **pdfkit**: Lightweight PDF generation without browser dependency

### Project Structure
```
playwright-qa-suite/
├── server/           # Backend API and test engine
│   ├── tests/        # 8 test modules (24 individual tests)
│   ├── reporters/    # PDF and JSON report generation
│   ├── index.js      # Express + WebSocket server
│   └── orchestrator.js  # Test execution coordinator
└── client/           # React frontend
    └── src/
        ├── components/  # UI panels and cards
        ├── hooks/       # WebSocket hook
        └── utils/       # Constants and helpers
```

### Running the Project
```bash
# Install dependencies
npm install
cd client && npm install

# Start backend
npm run server

# Start frontend (separate terminal)
npm run client

# Or run both together
npm run dev
```
