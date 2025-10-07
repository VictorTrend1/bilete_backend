# Fonts Directory

## Benzin-BOLD Font

This directory contains the Benzin-BOLD font file for custom BAL ticket generation.

### Font File:
- **File:** `benzin-bold.fnt` (converted from `benzin-bold.ttf`)
- **Purpose:** Used for displaying names on BAL tickets
- **Format:** Jimp-compatible BMFont format (.fnt)
- **Deployment:** Included in repository, no npm installation needed

### How to Convert TTF to FNT:

**Option 1: Online BMFont Converter**
1. Go to https://www.angelcode.com/products/bmfont/
2. Download BMFont tool
3. Open `benzin-bold.ttf` in BMFont
4. Export as BMFont format
5. Save as `benzin-bold.fnt`

**Option 2: Online Converters**
1. Use online TTF to BMFont converters
2. Upload `benzin-bold.ttf`
3. Download the converted `.fnt` file
4. Rename to `benzin-bold.fnt`

**Option 3: Command Line (if available)**
```bash
# If you have bmfont tools installed
bmfont -i benzin-bold.ttf -o benzin-bold.fnt
```

### How It Works:
1. TTF file is converted to FNT format
2. FNT file is committed to the repository
3. Gets deployed automatically with the backend code
4. No additional installation steps required
5. Works on any hosting platform (Render, Heroku, etc.)

### Fallback Behavior:
If the Benzin-BOLD font is not found, the system will automatically fall back to the built-in bold white font (Jimp.FONT_SANS_64_WHITE).

### Current Status:
- ✅ Font loading logic implemented
- ✅ Font directory structure created
- ⏳ Benzin-BOLD font file needs to be added to this directory
- ✅ Fallback font configured
