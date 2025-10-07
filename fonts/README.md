# Fonts Directory

## Benzin-BOLD Font

This directory contains the Benzin-BOLD font file for custom BAL ticket generation.

### Font File:
- **File:** `benzin-bold.fnt`
- **Purpose:** Used for displaying names on BAL tickets
- **Format:** Jimp-compatible BMFont format
- **Deployment:** Included in repository, no npm installation needed

### How It Works:
1. Font file is committed to the repository
2. Gets deployed automatically with the backend code
3. No additional installation steps required
4. Works on any hosting platform (Render, Heroku, etc.)

### Fallback Behavior:
If the Benzin-BOLD font is not found, the system will automatically fall back to the built-in bold white font (Jimp.FONT_SANS_64_WHITE).

### Current Status:
- ✅ Font loading logic implemented
- ✅ Font directory structure created
- ⏳ Benzin-BOLD font file needs to be added to this directory
- ✅ Fallback font configured
