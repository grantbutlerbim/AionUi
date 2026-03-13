/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { PPTJsonData, PPTSlideData } from '@/common/types/conversion';
import { usePreviewToolbarExtras } from '../../context/PreviewToolbarExtrasContext';
import { Button } from '@arco-design/web-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface PPTPreviewProps {
  /**
   * PPT file path (absolute path on disk)
   */
  filePath?: string;
  /**
   * PPT content (not used, kept for compatibility)
   */
  content?: string;
  hideToolbar?: boolean;
}

/**
 * Recursively extract all text strings from a pptx2json parsed slide object.
 * PPTX text lives in `a:t` nodes (XML namespace `a` = DrawingML).
 */
function extractTextFromSlide(node: unknown): string[] {
  if (node === null || node === undefined) return [];
  if (typeof node === 'string') return node.trim() ? [node.trim()] : [];
  if (typeof node === 'number') return [String(node)];
  if (Array.isArray(node)) {
    return node.flatMap((item) => extractTextFromSlide(item));
  }
  if (typeof node === 'object') {
    const obj = node as Record<string, unknown>;
    const texts: string[] = [];
    for (const key of Object.keys(obj)) {
      // a:t holds actual text content
      if (key === 'a:t' || key === 'at') {
        const val = obj[key];
        const extracted = extractTextFromSlide(val);
        texts.push(...extracted);
      } else {
        texts.push(...extractTextFromSlide(obj[key]));
      }
    }
    return texts;
  }
  return [];
}

/**
 * Extract paragraphs from a slide by grouping text runs within `a:p` elements.
 * Falls back to a flat list of text if structure is unexpected.
 */
function extractParagraphsFromSlide(slideContent: unknown): string[] {
  if (!slideContent) return [];

  const paragraphs: string[] = [];

  function collectParagraphs(node: unknown): void {
    if (node === null || node === undefined) return;
    if (Array.isArray(node)) {
      node.forEach(collectParagraphs);
      return;
    }
    if (typeof node === 'object') {
      const obj = node as Record<string, unknown>;
      for (const key of Object.keys(obj)) {
        if (key === 'a:p') {
          // Each a:p is a paragraph — extract all a:t under it
          const pNodes = Array.isArray(obj[key]) ? (obj[key] as unknown[]) : [obj[key]];
          for (const pNode of pNodes) {
            const texts = extractTextFromSlide(pNode);
            const line = texts.join('').trim();
            if (line) paragraphs.push(line);
          }
        } else {
          collectParagraphs(obj[key]);
        }
      }
    }
  }

  collectParagraphs(slideContent);

  // If no paragraphs found, fall back to flat text extraction
  if (paragraphs.length === 0) {
    const texts = extractTextFromSlide(slideContent);
    return texts.filter(Boolean);
  }

  return paragraphs;
}

interface SlideViewProps {
  slide: PPTSlideData;
  isActive: boolean;
}

const SlideView: React.FC<SlideViewProps> = ({ slide, isActive }) => {
  const { t } = useTranslation();
  const paragraphs = extractParagraphsFromSlide(slide.content);

  return (
    <div
      className={`border rounded-8px p-20px mb-4px transition-all ${
        isActive
          ? 'border-brand bg-bg-2 shadow-md'
          : 'border-border-1 bg-bg-1'
      }`}
    >
      <div className='text-11px text-t-tertiary mb-12px font-medium uppercase tracking-wider'>
        {t('preview.ppt.slideLabel', { number: slide.slideNumber })}
      </div>
      {paragraphs.length > 0 ? (
        <div className='space-y-6px'>
          {paragraphs.map((para, idx) => (
            <p key={idx} className='text-14px text-t-primary leading-relaxed break-words whitespace-pre-wrap'>
              {para}
            </p>
          ))}
        </div>
      ) : (
        <div className='text-13px text-t-tertiary italic'>{t('preview.ppt.noContent')}</div>
      )}
    </div>
  );
};

/**
 * PPT Presentation Viewer Component
 *
 * Loads the PPTX file via the main process conversion service,
 * extracts text content from each slide, and renders a readable
 * slide-by-slide view. An "Open in System App" button is always
 * available for full-fidelity viewing.
 */
const PPTPreview: React.FC<PPTPreviewProps> = ({ filePath, hideToolbar = false }) => {
  const { t } = useTranslation();
  const [pptData, setPptData] = useState<PPTJsonData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSlide, setActiveSlide] = useState(0);

  const toolbarExtrasContext = usePreviewToolbarExtras();
  const usePortalToolbar = Boolean(toolbarExtrasContext) && !hideToolbar;

  const slideCount = pptData?.slides.length;

  useEffect(() => {
    if (!usePortalToolbar || !toolbarExtrasContext) return;
    toolbarExtrasContext.setExtras({
      left: (
        <div className='flex items-center gap-8px'>
          <span className='text-13px text-t-secondary'>📊 {t('preview.pptTitle')}</span>
          <span className='text-11px text-t-tertiary'>{t('preview.readOnlyLabel')}</span>
          {typeof slideCount === 'number' && (
            <span className='text-12px text-t-secondary'>
              {t('preview.ppt.slideCount', { count: slideCount })}
            </span>
          )}
        </div>
      ),
      right: null,
    });
    return () => toolbarExtrasContext.setExtras(null);
  }, [usePortalToolbar, toolbarExtrasContext, slideCount, t]);

  useEffect(() => {
    const loadPpt = async () => {
      if (!filePath) {
        setError(t('preview.errors.missingFilePath'));
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await ipcBridge.document.convert.invoke({ filePath, to: 'ppt-json' });

        if (response.to !== 'ppt-json') {
          throw new Error(t('preview.ppt.convertFailed'));
        }

        if (response.result.success && response.result.data) {
          setPptData(response.result.data);
          setActiveSlide(0);
        } else {
          throw new Error(response.result.error || t('preview.ppt.convertFailed'));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : t('preview.ppt.loadFailed'));
      } finally {
        setLoading(false);
      }
    };

    void loadPpt();
  }, [filePath, t]);

  const handleOpenExternal = useCallback(async () => {
    if (!filePath) return;
    try {
      await ipcBridge.shell.openFile.invoke(filePath);
    } catch {
      // silently handle
    }
  }, [filePath]);

  const handleShowInFolder = useCallback(async () => {
    if (!filePath) return;
    try {
      await ipcBridge.shell.showItemInFolder.invoke(filePath);
    } catch {
      // silently handle
    }
  }, [filePath]);

  if (loading) {
    return (
      <div className='h-full w-full bg-bg-1 flex items-center justify-center'>
        <div className='text-center'>
          <div className='text-32px mb-12px'>📊</div>
          <div className='text-14px text-t-secondary'>{t('preview.ppt.loading')}</div>
        </div>
      </div>
    );
  }

  if (error || !pptData) {
    return (
      <div className='h-full w-full bg-bg-1 flex items-center justify-center'>
        <div className='text-center max-w-400px'>
          <div className='text-48px mb-16px'>📊</div>
          <div className='text-16px text-t-primary font-medium mb-8px'>{t('preview.pptTitle')}</div>
          <div className='text-13px text-t-secondary mb-8px'>{error || t('preview.ppt.loadFailed')}</div>
          <div className='text-13px text-t-secondary mb-24px'>{t('preview.pptOpenHint')}</div>
          {filePath && (
            <div className='flex items-center justify-center gap-12px'>
              <Button size='small' onClick={handleOpenExternal}>
                {t('preview.pptOpenFile')}
              </Button>
              <Button size='small' onClick={handleShowInFolder}>
                {t('preview.pptShowLocation')}
              </Button>
            </div>
          )}
          <div className='text-11px text-t-tertiary mt-16px'>{t('preview.pptSystemAppHint')}</div>
        </div>
      </div>
    );
  }

  const slides = pptData.slides;

  if (slides.length === 0) {
    return (
      <div className='h-full w-full bg-bg-1 flex items-center justify-center'>
        <div className='text-center max-w-400px'>
          <div className='text-48px mb-16px'>📊</div>
          <div className='text-16px text-t-primary font-medium mb-8px'>{t('preview.pptTitle')}</div>
          <div className='text-13px text-t-secondary mb-24px'>{t('preview.ppt.noSlides')}</div>
          {filePath && (
            <div className='flex items-center justify-center gap-12px'>
              <Button size='small' onClick={handleOpenExternal}>
                {t('preview.pptOpenFile')}
              </Button>
              <Button size='small' onClick={handleShowInFolder}>
                {t('preview.pptShowLocation')}
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className='h-full w-full bg-bg-1 flex overflow-hidden'>
      {/* Slide thumbnail list */}
      <div className='w-160px flex-shrink-0 border-r border-border-1 overflow-y-auto bg-bg-2 p-8px'>
        {slides.map((slide, idx) => {
          const paragraphs = extractParagraphsFromSlide(slide.content);
          const preview = paragraphs[0] || '';
          return (
            <button
              key={slide.slideNumber}
              onClick={() => setActiveSlide(idx)}
              className={`w-full text-left rounded-6px p-8px mb-4px cursor-pointer border transition-all ${
                idx === activeSlide
                  ? 'border-brand bg-brand-light-1 text-brand'
                  : 'border-transparent hover:bg-bg-3 text-t-secondary'
              }`}
            >
              <div className='text-10px font-semibold mb-4px'>
                {t('preview.ppt.slideLabel', { number: slide.slideNumber })}
              </div>
              {preview && (
                <div className='text-10px leading-tight line-clamp-2 text-t-tertiary break-words'>
                  {preview}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Main slide content */}
      <div className='flex-1 overflow-hidden flex flex-col'>
        {/* Toolbar */}
        <div className='flex items-center justify-between px-16px py-8px border-b border-border-1 bg-bg-1 flex-shrink-0'>
          <div className='flex items-center gap-8px'>
            <span className='text-13px text-t-secondary font-medium'>
              {t('preview.ppt.slideLabel', { number: slides[activeSlide].slideNumber })}
            </span>
            <span className='text-12px text-t-tertiary'>
              / {t('preview.ppt.slideCount', { count: slides.length })}
            </span>
          </div>
          <div className='flex items-center gap-8px'>
            <Button
              size='mini'
              disabled={activeSlide === 0}
              onClick={() => setActiveSlide((i) => Math.max(0, i - 1))}
            >
              ‹
            </Button>
            <Button
              size='mini'
              disabled={activeSlide === slides.length - 1}
              onClick={() => setActiveSlide((i) => Math.min(slides.length - 1, i + 1))}
            >
              ›
            </Button>
            {filePath && (
              <Button size='mini' onClick={handleOpenExternal}>
                {t('preview.pptOpenFile')}
              </Button>
            )}
          </div>
        </div>

        {/* Slide content */}
        <div className='flex-1 overflow-y-auto p-24px'>
          <SlideView slide={slides[activeSlide]} isActive={true} />
        </div>
      </div>
    </div>
  );
};

export default PPTPreview;
