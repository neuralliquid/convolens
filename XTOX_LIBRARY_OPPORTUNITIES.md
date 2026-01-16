# xtox Library Opportunities Analysis

## Executive Summary

After analyzing the xtox codebase and related projects, here are the identified opportunities for creating reusable "x to x" conversion libraries.

## Current State

### ✅ Existing in xtox (Python)
1. **Document Conversion** (`xtox/core/`)
   - `markdown_to_latex.py` - Markdown → LaTeX
   - `markdown_to_html.py` - Markdown → HTML
   - `markdown_to_docx.py` - Markdown → DOCX
   - `html_to_markdown.py` - HTML → Markdown
   - `latex_to_pdf.py` - LaTeX → PDF
   - `document_converter.py` - Main converter orchestrator

2. **Image Conversion** (`xtox/core/`)
   - `image_converter.py` - Image format → Image format (JPEG, PNG, WebP, etc.)
   - Uses Pillow/PIL for conversion and compression

3. **Audio Conversion** (`xtox/core/`)
   - `audio_converter.py` - Audio format → Audio format (OGG, MP3, WAV, etc.)
   - Uses FFmpeg or pydub for conversion

4. **Utilities** (`xtox/backend/utils/`, `xtox/utils/`)
   - `file_validator.py` - File validation utilities
   - `security.py` - Filename sanitization, path validation
   - `image_handler.py` - Image copying/path management

### ✅ Existing as TypeScript/Node.js Library
1. **Transcription** (`xtox/lib/transcription/`)
   - Audio → Text using Azure OpenAI Whisper
   - TypeScript package for Node.js/Next.js apps

## 🎯 High-Priority Opportunities

### 1. **OCR Service** (Image/PDF → Text)
**Status**: ❌ Does NOT exist  
**Priority**: HIGH  
**Use Cases**:
- Extract text from scanned documents
- Read text from images in documents
- Parse receipts, invoices, forms
- Make image-heavy PDFs searchable

**Implementation Plan**:
```
xtox/lib/ocr/
├── src/
│   ├── index.ts
│   ├── providers/
│   │   ├── tesseract.provider.ts    # Free, local OCR
│   │   ├── azure-vision.provider.ts # Azure Computer Vision
│   │   └── google-vision.provider.ts # Google Cloud Vision
│   └── types.ts
├── package.json
├── tsconfig.json
└── README.md
```

**API Design**:
```typescript
import { OCRService } from '@xtox/ocr-service';

// Initialize
const ocr = OCRService.fromEnvironment(); // or with config

// Extract text from image
const result = await ocr.extractText(imageFile);
// result.text, result.confidence, result.language

// With specific provider
const azureOCR = new OCRService({
  provider: 'azure',
  endpoint: '...',
  apiKey: '...'
});
```

**Technologies**:
- **Tesseract.js** (free, local, good for basic OCR)
- **Azure Computer Vision** (enterprise-grade, multilingual)
- **Google Cloud Vision** (enterprise-grade alternative)

---

### 2. **Video Conversion Service** (Video Format → Video Format)
**Status**: ❌ Does NOT exist  
**Priority**: MEDIUM  
**Use Cases**:
- Convert video formats (MP4, WebM, AVI, MOV)
- Extract frames from videos
- Generate video thumbnails
- Compress videos for web

**Implementation**: Similar to audio converter, use FFmpeg
```
xtox/lib/video-converter/
├── src/
│   ├── index.ts
│   ├── converter.ts
│   ├── frame-extractor.ts
│   └── thumbnail-generator.ts
└── package.json
```

---

### 3. **Speech Synthesis Service** (Text → Audio)
**Status**: ❌ Does NOT exist  
**Priority**: MEDIUM  
**Use Cases**:
- Text-to-speech for accessibility
- Generate audio narration
- Voice notifications
- Audiobook generation

**Implementation**:
```
xtox/lib/tts/
├── src/
│   ├── index.ts
│   └── providers/
│       ├── azure-tts.provider.ts
│       ├── google-tts.provider.ts
│       └── elevenlabs.provider.ts
└── package.json
```

---

### 4. **Data Format Converters** (Structured Data ↔ Structured Data)
**Status**: ❌ Does NOT exist  
**Priority**: MEDIUM-LOW  
**Use Cases**:
- JSON ↔ CSV
- JSON ↔ YAML
- CSV ↔ Excel
- XML ↔ JSON

**Note**: These are so common that using existing libraries directly might be better than wrapping them.

---

### 5. **Code Formatter/Prettifier** (Code → Formatted Code)
**Status**: ❌ Does NOT exist  
**Priority**: LOW  
**Use Cases**:
- Auto-format code in documentation
- Standardize code examples
- Convert code between styles

**Note**: Prettier, Black, etc. already exist. Only worth creating if xtox needs a unified API across languages.

---

## 🔄 Migration Opportunities (Python → TypeScript)

These exist in Python but could be ported to TypeScript for Node.js/Next.js apps:

### 1. **HTML ↔ Markdown Converter**
**Current**: Python only (`html_to_markdown.py`)  
**Opportunity**: Create TypeScript version  
**Use Case**: ConvoLens might need this for rich text editing

```
xtox/lib/html-markdown/
├── src/
│   ├── html-to-markdown.ts
│   └── markdown-to-html.ts
└── package.json
```

---

### 2. **Image Converter** (TypeScript version)
**Current**: Python only (`image_converter.py`)  
**Opportunity**: Create TypeScript/Node.js version  
**Use Case**: Web apps needing image processing

```
xtox/lib/image-converter/
├── src/
│   ├── index.ts
│   ├── converter.ts
│   └── compressor.ts
└── package.json
```

**Technologies**: Sharp (Node.js image library)

---

### 3. **Audio Converter** (TypeScript version)
**Current**: Python only (`audio_converter.py`)  
**Opportunity**: Create TypeScript version if needed  
**Note**: Less urgent since transcription service already handles audio

---

## 🚫 What Should NOT Be in xtox

### Application-Specific Parsers
- **ConvoLens chat parsers** - Parse WhatsApp/Telegram exports into app-specific data models
- **Mystira game parsers** - Parse game-specific data formats
- **Any business logic** that's tied to a specific application's domain

### Rule of Thumb:
If it transforms generic formats (PDF, image, audio, text) → it belongs in xtox  
If it parses app-specific data into app-specific models → it stays in the app

---

## 📋 Recommended Roadmap

### Phase 1: Critical Missing Functionality
1. **OCR Service** (`@xtox/ocr-service`) - HIGH PRIORITY
   - Start with Tesseract.js (free, local)
   - Add Azure Vision as enterprise option
   - Target: 2-3 weeks

### Phase 2: Common Web Needs
2. **HTML ↔ Markdown** (`@xtox/html-markdown`) - MEDIUM PRIORITY
   - Port Python version to TypeScript
   - Use Turndown.js for HTML→Markdown
   - Use Marked.js for Markdown→HTML
   - Target: 1 week

3. **Image Converter** (`@xtox/image-converter`) - MEDIUM PRIORITY
   - TypeScript version using Sharp
   - Format conversion, compression, resizing
   - Target: 1-2 weeks

### Phase 3: Advanced Features
4. **Video Converter** (`@xtox/video-converter`) - LOWER PRIORITY
   - FFmpeg wrapper for Node.js
   - Format conversion, thumbnails, frame extraction
   - Target: 2-3 weeks

5. **Speech Synthesis** (`@xtox/tts-service`) - LOWER PRIORITY
   - Text-to-speech using Azure/Google TTS
   - Target: 1-2 weeks

---

## 🏗️ Architecture Pattern

All xtox libraries should follow this pattern:

### Directory Structure
```
xtox/lib/<library-name>/
├── src/
│   ├── index.ts              # Main export
│   ├── types.ts              # TypeScript interfaces
│   ├── <service>.service.ts  # Main service class
│   └── providers/            # Optional: multiple providers
│       ├── provider-a.ts
│       └── provider-b.ts
├── tests/
│   └── <service>.test.ts
├── package.json
├── tsconfig.json
└── README.md
```

### Service Pattern
```typescript
export class ServiceName {
  private config: ServiceConfig;

  constructor(config: ServiceConfig) {
    this.config = config;
  }

  // Convenience factory method
  static fromEnvironment(): ServiceName {
    return new ServiceName({
      endpoint: process.env.SERVICE_ENDPOINT,
      apiKey: process.env.SERVICE_API_KEY,
      // ...
    });
  }

  // Main conversion method(s)
  async convert(input: InputType): Promise<OutputType> {
    // Implementation
  }

  // Validation helper
  static isValidInput(input: any): boolean {
    // Validation logic
  }
}
```

### Package.json Pattern
```json
{
  "name": "@xtox/<library-name>",
  "version": "1.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": ["dist"],
  "scripts": {
    "build": "tsc",
    "test": "jest"
  }
}
```

---

## 🎯 Next Steps

1. **Prioritize**: Decide which libraries to build first (Recommend: OCR)
2. **Prototype**: Build OCR service as proof of concept
3. **Document**: Create WARP.md for xtox with library contribution guidelines
4. **Standardize**: Establish patterns for all future libraries
5. **Migrate**: Port useful Python converters to TypeScript as needed

---

## 📊 Summary Matrix

| Library | Status | Priority | Effort | Impact | Language |
|---------|--------|----------|--------|--------|----------|
| OCR Service | ❌ Missing | HIGH | 2-3 weeks | HIGH | TypeScript |
| HTML↔Markdown | 🐍 Python only | MEDIUM | 1 week | MEDIUM | TypeScript |
| Image Converter (TS) | 🐍 Python only | MEDIUM | 1-2 weeks | MEDIUM | TypeScript |
| Video Converter | ❌ Missing | MEDIUM-LOW | 2-3 weeks | MEDIUM | TypeScript |
| Speech Synthesis | ❌ Missing | LOW | 1-2 weeks | LOW | TypeScript |
| Transcription | ✅ Exists | - | - | - | TypeScript |
| Audio Converter (Py) | ✅ Exists | - | - | - | Python |
| Image Converter (Py) | ✅ Exists | - | - | - | Python |
| Document Converters | ✅ Exists | - | - | - | Python |

**Legend**:
- ✅ = Exists and ready
- 🐍 = Exists in Python only
- ❌ = Does not exist
