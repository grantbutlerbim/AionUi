/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useRef } from 'react';

/**
 * 滚动同步 Hook 配置
 * Scroll sync hook configuration
 */
interface UseScrollSyncOptions {
  /**
   * 是否启用滚动同步
   * Whether to enable scroll sync
   */
  enabled: boolean;

  /**
   * 编辑器容器引用
   * Editor container ref
   */
  editorContainerRef: React.RefObject<HTMLDivElement>;

  /**
   * 预览容器引用
   * Preview container ref
   */
  previewContainerRef: React.RefObject<HTMLDivElement>;
}

/**
 * 滚动同步 Hook 返回值
 * Scroll sync hook return value
 */
interface UseScrollSyncReturn {
  /**
   * 处理编辑器滚动事件
   * Handle editor scroll event
   */
  handleEditorScroll: (scrollTop: number, scrollHeight: number, clientHeight: number) => void;

  /**
   * 处理预览器滚动事件
   * Handle preview scroll event
   */
  handlePreviewScroll: (scrollTop: number, scrollHeight: number, clientHeight: number) => void;
}

/**
 * 分屏模式下的滚动同步 Hook
 * Scroll synchronization hook for split-screen mode
 *
 * 在编辑器和预览器之间同步滚动位置，基于滚动百分比进行同步
 * Synchronizes scroll position between editor and preview based on scroll percentage
 *
 * 使用防抖机制避免循环触发和性能问题
 * Uses debounce mechanism to avoid circular triggers and performance issues
 *
 * 使用 requestAnimationFrame 将 DOM 写操作与浏览器渲染周期对齐，
 * 并通过双 rAF 模式在帧绘制完成后重置同步标志
 * Uses requestAnimationFrame to align DOM writes with the browser render cycle,
 * and a double-rAF pattern to reset the sync flag after the frame is painted
 *
 * @param options - 滚动同步配置 / Scroll sync configuration
 * @returns 滚动事件处理函数 / Scroll event handlers
 */
export const useScrollSync = ({ enabled, editorContainerRef, previewContainerRef }: UseScrollSyncOptions): UseScrollSyncReturn => {
  const isSyncingRef = useRef(false);

  const handleEditorScroll = useCallback(
    (scrollTop: number, scrollHeight: number, clientHeight: number) => {
      if (!enabled || isSyncingRef.current) return;

      isSyncingRef.current = true;
      const scrollPercentage = scrollTop / (scrollHeight - clientHeight || 1);

      requestAnimationFrame(() => {
        const previewContainer = previewContainerRef.current;
        if (previewContainer) {
          // 使用 data 属性传递目标滚动百分比，由各组件自行处理
          // Use data attribute to pass target scroll percentage, each component handles it
          previewContainer.dataset.targetScrollPercent = String(scrollPercentage);
          // 同时尝试直接设置 scrollTop（对于支持的组件）
          // Also try to set scrollTop directly (for components that support it)
          const targetScroll = scrollPercentage * (previewContainer.scrollHeight - previewContainer.clientHeight);
          previewContainer.scrollTop = targetScroll;
        }

        // 在下一帧绘制完成后重置同步标志，确保程序化滚动事件已分发
        // Reset sync flag after the next frame is painted, ensuring programmatic scroll events have dispatched
        requestAnimationFrame(() => {
          isSyncingRef.current = false;
        });
      });
    },
    [enabled, previewContainerRef]
  );

  const handlePreviewScroll = useCallback(
    (scrollTop: number, scrollHeight: number, clientHeight: number) => {
      if (!enabled || isSyncingRef.current) return;

      isSyncingRef.current = true;
      const scrollPercentage = scrollTop / (scrollHeight - clientHeight || 1);

      requestAnimationFrame(() => {
        const editorContainer = editorContainerRef.current;
        if (editorContainer) {
          // 使用 data 属性传递目标滚动百分比，由各组件自行处理
          // Use data attribute to pass target scroll percentage, each component handles it
          editorContainer.dataset.targetScrollPercent = String(scrollPercentage);
          // 同时尝试直接设置 scrollTop（对于支持的组件）
          // Also try to set scrollTop directly (for components that support it)
          const targetScroll = scrollPercentage * (editorContainer.scrollHeight - editorContainer.clientHeight);
          editorContainer.scrollTop = targetScroll;
        }

        // 在下一帧绘制完成后重置同步标志，确保程序化滚动事件已分发
        // Reset sync flag after the next frame is painted, ensuring programmatic scroll events have dispatched
        requestAnimationFrame(() => {
          isSyncingRef.current = false;
        });
      });
    },
    [enabled, editorContainerRef]
  );

  return {
    handleEditorScroll,
    handlePreviewScroll,
  };
};
