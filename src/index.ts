import {
    Plugin,
    Setting,
    getActiveEditor,
    getFrontend,
} from "siyuan";
import "./index.scss";

const STORAGE_NAME = "select-opened-doc-config.json";

// 原始代码片段：https://ld246.com/article/1727980528164
export default class SelectOpenedDocPlugin extends Plugin {
    private isMobile: boolean;
    private focusButton: HTMLElement;
    private originalButtonText: string;

    async onload() {
        const frontEnd = getFrontend();
        this.isMobile = frontEnd === "mobile" || frontEnd === "browser-mobile";
        // 加载配置
        await this.loadData(STORAGE_NAME);
        // 默认配置
        this.data[STORAGE_NAME] ||= {}; // 默认是空字符串，所以用 ||? 而不是 ??=
        this.data[STORAGE_NAME].desktopFoldKey ??= "right"; // 默认是鼠标右键折叠文档树
        this.data[STORAGE_NAME].mobileFoldKey ??= "longPress"; // 默认是长按折叠文档树
        this.data[STORAGE_NAME].changeButtonText ??= // 如果是插件 i18n 支持的语种，则默认修改按钮文案，否则不修改
            ["zh_CN", "zh_CHT", "en_US"].includes(window.siyuan.config.lang) ? true : false;

        // 插件设置
        this.setting = new Setting({
            confirmCallback: () => {
                applySetting();
            }
        });

        // desktopFoldKey：下拉菜单
        const desktopFoldKeyElement = document.createElement("select");
        desktopFoldKeyElement.className = "b3-select fn__block";
        desktopFoldKeyElement.innerHTML = `
            <option value="left" ${this.data[STORAGE_NAME].desktopFoldKey === "left" ? "selected" : ""}>${this.i18n.buttonTextLeft}</option>
            <option value="right" ${this.data[STORAGE_NAME].desktopFoldKey === "right" ? "selected" : ""}>${this.i18n.buttonTextRight}</option>
        `;
        this.setting.addItem({
            title: this.i18n.desktopFoldKey,
            direction: "column",
            createActionElement: () => desktopFoldKeyElement,
        });

        // mobileFoldKey：下拉菜单
        const mobileFoldKeyElement = document.createElement("select");
        mobileFoldKeyElement.className = "b3-select fn__block";
        mobileFoldKeyElement.innerHTML = `
            <option value="click" ${this.data[STORAGE_NAME].mobileFoldKey === "click" ? "selected" : ""}>${this.i18n.mobileFoldKeyClick}</option>
            <option value="longPress" ${this.data[STORAGE_NAME].mobileFoldKey === "longPress" ? "selected" : ""}>${this.i18n.mobileFoldKeyLongPress}</option>
        `;
        this.setting.addItem({
            title: this.i18n.mobileFoldKey,
            direction: "column",
            createActionElement: () => mobileFoldKeyElement,
        });

        // changeButtonText：开关按钮
        // <input class="b3-switch fn__flex-center" id="changeButtonText" type="checkbox" checked="">
        const changeButtonTextElement = document.createElement("input");
        changeButtonTextElement.type = "checkbox";
        changeButtonTextElement.id = "changeButtonText";
        changeButtonTextElement.className = "b3-switch fn__flex-center";
        changeButtonTextElement.checked = this.data[STORAGE_NAME].changeButtonText;
        this.setting.addItem({
            title: this.i18n.changeButtonText,
            direction: "column",
            createActionElement: () => changeButtonTextElement,
        });

        // 应用配置
        const applySetting = async () => {
            // 需要 await 等待配置更新完成之后再使用 this.data[STORAGE_NAME]，否则会使用旧的配置
            await this.saveData(STORAGE_NAME, {
                desktopFoldKey: desktopFoldKeyElement.value,
                mobileFoldKey: mobileFoldKeyElement.value,
                changeButtonText: changeButtonTextElement.checked
            });

            // 更改文案或恢复原始文案
            this.changeButtonText();
        };
    }

    onLayoutReady() {
        this.focusButton = document.querySelector(":is(.sy__file .block__icon, #sidebar .fn__flex-column[data-type='sidebar-file'] .toolbar .toolbar__icon)[data-type='focus']");
        if (!this.focusButton) {
            console.error(this.displayName, this.i18n.onloadFailed);
            return;
        }

        // 为鼠标左键和鼠标右键单击添加相应的监听器
        this.focusButton.addEventListener('click', this.leftClickHandler);
        this.focusButton.addEventListener('contextmenu', this.rightClickHandler);
        // 移动端监听触摸事件
        this.focusButton.addEventListener('touchstart', this.touchstartHandler, { passive: false });
        this.focusButton.addEventListener('touchend', this.touchendHandler, { passive: false });

        // 修改按钮文案
        this.changeButtonText(true);

        console.log(this.displayName, this.i18n.onload);
    }

    onunload() {
        // 卸载事件监听器
        this.focusButton.removeEventListener('click', this.leftClickHandler);
        this.focusButton.removeEventListener('contextmenu', this.rightClickHandler);
        this.focusButton.removeEventListener('touchstart', this.touchstartHandler);
        this.focusButton.removeEventListener('touchend', this.touchendHandler);

        // 还原按钮文案
        this.restoreButtonText();

        console.log(this.displayName, this.i18n.onunload);
    }

    async uninstall() {
        // 卸载事件监听器
        this.focusButton.removeEventListener('click', this.leftClickHandler);
        this.focusButton.removeEventListener('contextmenu', this.rightClickHandler);
        this.focusButton.removeEventListener('touchstart', this.touchstartHandler);
        this.focusButton.removeEventListener('touchend', this.touchendHandler);

        // 还原按钮文案
        this.restoreButtonText();

        // 删除配置
        await this.removeData(STORAGE_NAME);

        console.log(this.displayName, this.i18n.uninstall);
    }

    private changeButtonText = (isFirst: boolean = false) => {
        // 移动端没有悬浮提示
        if (this.isMobile) return;

        const ariaLabel = this.focusButton.getAttribute('aria-label');
        if (isFirst) this.originalButtonText = ariaLabel;

        if (this.data[STORAGE_NAME].changeButtonText) {
            // 如果修改按钮文案
            this.focusButton.setAttribute('aria-label', this.data[STORAGE_NAME].desktopFoldKey === "right" ? this.i18n.buttonTextRight : this.i18n.buttonTextLeft );
        } else if (!isFirst && this.originalButtonText !== ariaLabel) {
            // 如果不修改按钮文案，并且不是第一次调用，并且原始文案和当前文案不一致，则恢复原始文案
            this.restoreButtonText();
        }
    }

    private restoreButtonText = () => {
        if (this.isMobile) return;
        this.focusButton.setAttribute('aria-label', this.originalButtonText);
    }

    private leftClickHandler = (e: MouseEvent) => {
        e.preventDefault();
        this.selectOpenedDoc("left");
    }

    private rightClickHandler = (e: MouseEvent) => {
        e.preventDefault();
        this.selectOpenedDoc("right");
    }

    // 用于存储长按定时器的 ID
    private longPressTimeout: ReturnType<typeof setTimeout> | undefined;

    // 用于避免触发 longPress 之后后重复触发 click
    private isLongPress = false;

    private touchstartHandler = (e: TouchEvent) => {
        e.preventDefault();
        // 开始计时，如果 300ms 内没有 touchend 事件，则认为是长按
        this.longPressTimeout = setTimeout(() => {
            this.isLongPress = true;
            this.selectOpenedDoc("longPress");
        }, 300);
    }

    private touchendHandler = (e: TouchEvent) => {
        e.preventDefault();
        // 清除长按定时器
        clearTimeout(this.longPressTimeout);
        if (this.isLongPress) {
            this.isLongPress = false;
        } else {
            this.selectOpenedDoc("click");
        }
    }

    // mousedown mouseup 跟 click 冲突了，导致触发两次，所以不使用

    /**
     * 折叠文档树
     * @param type 折叠定位的方式
     */
    private selectOpenedDoc = (type: "left" | "right" | "click" | "longPress") => {
        if (![this.data[STORAGE_NAME].desktopFoldKey, this.data[STORAGE_NAME].mobileFoldKey].includes(type)) {
            // 定位当前的文档，跟原来的交互一致
            this.expandDocTree();
        } else {
            // 折叠其他路径展开的文档，然后定位当前的文档
            const currentProtyle = getActiveEditor(false)?.protyle;
            const notebookId = currentProtyle?.notebookId;
            const path = currentProtyle?.path;

            const notebookElementLists = document.querySelectorAll(":is(.sy__file, #sidebar .fn__flex-column[data-type='sidebar-file']) .b3-list-item[data-type='navigation-root']");
            notebookElementLists.forEach(notebookElement => {
                const parentElement = notebookElement.parentElement;
                if (parentElement && notebookId && path && parentElement.dataset.url === notebookId) {
                    // 当前文档所在的笔记本单独处理
                    let ulRootElement = notebookElement.nextElementSibling;
                    while (ulRootElement) {
                        if (ulRootElement.tagName.toUpperCase() === "UL") break;
                        ulRootElement = ulRootElement.nextElementSibling;
                    }
                    if (ulRootElement) {
                        const ulElements = ulRootElement.getElementsByTagName("ul");
                        // 从 path 中按顺序提取所有形如“时间戳 + 7 位随机字符”的文档 ID
                        const idList = path.match(/\d{14}-\w{7}/g);
                        // 利用 HTMLCollection 的动态特性，使用 while 循环处理元素
                        let i = 0;
                        while (i < ulElements.length) {
                            const ulElement = ulElements[i];
                            const liElement = ulElement.previousElementSibling;
                            // 如果 liElement 不在当前路径，则移除 ulElement
                            if (liElement && !idList.includes(liElement.getAttribute("data-node-id"))) {
                                const arrowElement = liElement.querySelector(".b3-list-item__arrow");
                                if (arrowElement) arrowElement.classList.remove('b3-list-item__arrow--open');

                                ulElement.remove();
                                // 移除后 ulElements 会自动更新，当前索引 i 不变
                            } else {
                                // 如果是路径上的节点，跳过，处理下一个
                                i++;
                            }
                        }
                    }
                    return;
                } else {
                    const arrowElement = notebookElement.querySelector('.b3-list-item__arrow');
                    if (arrowElement) arrowElement.classList.remove('b3-list-item__arrow--open');
    
                    let ulElement = notebookElement.nextElementSibling;
                    while (ulElement) {
                        if (ulElement.tagName.toUpperCase() === "UL") break;
                        ulElement = ulElement.nextElementSibling;
                    }
                    if (ulElement) ulElement.remove();
                }
            });

            this.expandDocTree();
        }
    }

    /**
     * 展开文档树
     */
    private expandDocTree = () => {
        if (!this.focusButton) return;

        // TODO跟进: 换成原生方法 https://github.com/siyuan-note/siyuan/issues/15639
        
        // 移除点击事件监听器，避免模拟点击触发事件监听器
        this.focusButton.removeEventListener('click', this.leftClickHandler);

        // 模拟点击按钮
        if (typeof this.focusButton.click === 'function') {
            // 使用标准的 click 方法
            this.focusButton.click();
        } else {
            // 移动端按钮没有 click 方法，使用备用方法：创建并触发点击事件
            const clickEvent = new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                view: window
            });
            this.focusButton.dispatchEvent(clickEvent);
        }
    
        // 恢复点击事件监听器
        setTimeout(() => {
            this.focusButton.addEventListener('click', this.leftClickHandler);
        }, 0);
    }
}
