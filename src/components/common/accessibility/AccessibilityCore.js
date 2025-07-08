/**
 * Accessibility Core - 접근성 핵심 기능
 * 스크린 리더 지원, 키보드 네비게이션, ARIA 속성 관리
 */

class AccessibilityCore {
    constructor() {
        this.announceRegion = null;
        this.keyboardNavigation = null;
        this.focusManager = null;
        this.ariaManager = null;
        
        this.init();
    }

    init() {
        this.createAnnounceRegion();
        this.setupKeyboardNavigation();
        this.setupFocusManager();
        this.setupAriaManager();
    }

    /**
     * 스크린 리더 알림 영역 생성
     */
    createAnnounceRegion() {
        this.announceRegion = document.createElement('div');
        this.announceRegion.id = 'accessibility-announce-region';
        this.announceRegion.setAttribute('aria-live', 'polite');
        this.announceRegion.setAttribute('aria-atomic', 'true');
        this.announceRegion.style.cssText = `
            position: absolute;
            left: -10000px;
            width: 1px;
            height: 1px;
            overflow: hidden;
        `;
        document.body.appendChild(this.announceRegion);
    }

    /**
     * 키보드 네비게이션 설정
     */
    setupKeyboardNavigation() {
        this.keyboardNavigation = {
            currentFocus: null,
            focusableElements: [],
            
            updateFocusableElements() {
                this.focusableElements = Array.from(document.querySelectorAll(
                    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
                )).filter(el => !el.disabled && el.offsetParent !== null);
            },
            
            focusNext() {
                this.updateFocusableElements();
                const currentIndex = this.focusableElements.indexOf(document.activeElement);
                const nextIndex = (currentIndex + 1) % this.focusableElements.length;
                this.focusableElements[nextIndex]?.focus();
            },
            
            focusPrevious() {
                this.updateFocusableElements();
                const currentIndex = this.focusableElements.indexOf(document.activeElement);
                const prevIndex = currentIndex <= 0 ? this.focusableElements.length - 1 : currentIndex - 1;
                this.focusableElements[prevIndex]?.focus();
            },
            
            setupTreeNavigation(treeElement) {
                if (!treeElement) return;
                
                treeElement.addEventListener('keydown', (e) => {
                    const treeItems = Array.from(treeElement.querySelectorAll('[role="treeitem"]'));
                    const currentIndex = treeItems.indexOf(document.activeElement);
                    
                    switch (e.key) {
                        case 'ArrowDown':
                            e.preventDefault();
                            const nextIndex = (currentIndex + 1) % treeItems.length;
                            treeItems[nextIndex]?.focus();
                            break;
                            
                        case 'ArrowUp':
                            e.preventDefault();
                            const prevIndex = currentIndex <= 0 ? treeItems.length - 1 : currentIndex - 1;
                            treeItems[prevIndex]?.focus();
                            break;
                            
                        case 'ArrowRight':
                            e.preventDefault();
                            const currentItem = treeItems[currentIndex];
                            if (currentItem?.getAttribute('aria-expanded') === 'false') {
                                currentItem.setAttribute('aria-expanded', 'true');
                                currentItem.click();
                            }
                            break;
                            
                        case 'ArrowLeft':
                            e.preventDefault();
                            const currentItem2 = treeItems[currentIndex];
                            if (currentItem2?.getAttribute('aria-expanded') === 'true') {
                                currentItem2.setAttribute('aria-expanded', 'false');
                                currentItem2.click();
                            }
                            break;
                    }
                });
            }
        };
    }

    /**
     * 포커스 관리자 설정
     */
    setupFocusManager() {
        this.focusManager = {
            focusHistory: [],
            
            saveFocus() {
                const activeElement = document.activeElement;
                if (activeElement && activeElement !== document.body) {
                    this.focusHistory.push(activeElement);
                }
            },
            
            restoreFocus() {
                if (this.focusHistory.length > 0) {
                    const lastFocus = this.focusHistory.pop();
                    if (lastFocus && document.contains(lastFocus)) {
                        lastFocus.focus();
                        return true;
                    }
                }
                return false;
            },
            
            trapFocus(container) {
                const focusableElements = container.querySelectorAll(
                    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
                );
                
                if (focusableElements.length === 0) return null;
                
                const firstElement = focusableElements[0];
                const lastElement = focusableElements[focusableElements.length - 1];
                
                const trapHandler = (e) => {
                    if (e.key === 'Tab') {
                        if (e.shiftKey) {
                            if (document.activeElement === firstElement) {
                                e.preventDefault();
                                lastElement.focus();
                            }
                        } else {
                            if (document.activeElement === lastElement) {
                                e.preventDefault();
                                firstElement.focus();
                            }
                        }
                    }
                };
                
                container.addEventListener('keydown', trapHandler);
                firstElement.focus();
                
                return () => {
                    container.removeEventListener('keydown', trapHandler);
                };
            }
        };
    }

    /**
     * ARIA 관리자 설정
     */
    setupAriaManager() {
        this.ariaManager = {
            updateAriaLabel(element, label) {
                if (element) {
                    element.setAttribute('aria-label', label);
                }
            },
            
            updateAriaDescription(element, description) {
                if (element) {
                    element.setAttribute('aria-describedby', description);
                }
            },
            
            updateAriaExpanded(element, expanded) {
                if (element) {
                    element.setAttribute('aria-expanded', expanded.toString());
                }
            },
            
            updateAriaSelected(element, selected) {
                if (element) {
                    element.setAttribute('aria-selected', selected.toString());
                }
            },
            
            updateAriaActivedescendant(container, descendant) {
                if (container) {
                    if (descendant) {
                        container.setAttribute('aria-activedescendant', descendant.id || '');
                    } else {
                        container.removeAttribute('aria-activedescendant');
                    }
                }
            },
            
            setRole(element, role) {
                if (element) {
                    element.setAttribute('role', role);
                }
            },
            
            setupTreeView(container) {
                if (!container) return;
                
                container.setAttribute('role', 'tree');
                container.setAttribute('aria-label', '파일 탐색기');
                
                const treeItems = container.querySelectorAll('.tree-item');
                treeItems.forEach((item, index) => {
                    item.setAttribute('role', 'treeitem');
                    item.setAttribute('tabindex', index === 0 ? '0' : '-1');
                    
                    const hasChildren = item.querySelector('.tree-children');
                    if (hasChildren) {
                        item.setAttribute('aria-expanded', 'false');
                    }
                });
            }
        };
    }

    /**
     * 스크린 리더에 메시지 알림
     */
    announce(message, priority = 'polite') {
        if (!this.announceRegion) return;
        
        this.announceRegion.setAttribute('aria-live', priority);
        this.announceRegion.textContent = message;
        
        // 잠시 후 내용 지우기
        setTimeout(() => {
            this.announceRegion.textContent = '';
        }, 1000);
    }

    /**
     * 키보드 네비게이션 반환
     */
    getKeyboardNavigation() {
        return this.keyboardNavigation;
    }

    /**
     * 포커스 관리자 반환
     */
    getFocusManager() {
        return this.focusManager;
    }

    /**
     * ARIA 관리자 반환
     */
    getAriaManager() {
        return this.ariaManager;
    }

    /**
     * 접근성 진단 실행
     */
    runAccessibilityDiagnostics() {
        const diagnostics = {
            announceRegion: !!this.announceRegion,
            keyboardNavigation: !!this.keyboardNavigation,
            focusManager: !!this.focusManager,
            ariaManager: !!this.ariaManager,
            focusableElementsCount: this.keyboardNavigation?.focusableElements?.length || 0,
            currentFocus: document.activeElement?.tagName || 'none',
            ariaLabels: document.querySelectorAll('[aria-label]').length,
            ariaDescriptions: document.querySelectorAll('[aria-describedby]').length,
            roles: document.querySelectorAll('[role]').length
        };
        
        return diagnostics;
    }

    /**
     * 접근성 상태 반환
     */
    getAccessibilityStatus() {
        return {
            announceRegionExists: !!this.announceRegion,
            keyboardNavigationEnabled: !!this.keyboardNavigation,
            focusManagerEnabled: !!this.focusManager,
            ariaManagerEnabled: !!this.ariaManager,
            focusHistoryLength: this.focusManager?.focusHistory?.length || 0
        };
    }

    /**
     * 리소스 정리
     */
    destroy() {
        if (this.announceRegion && this.announceRegion.parentNode) {
            this.announceRegion.parentNode.removeChild(this.announceRegion);
        }
        
        this.announceRegion = null;
        this.keyboardNavigation = null;
        this.focusManager = null;
        this.ariaManager = null;
    }
}

export { AccessibilityCore };