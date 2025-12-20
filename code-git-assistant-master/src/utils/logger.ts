import * as vscode from 'vscode';

/**
 * 日志记录器
 */
export class Logger {
    private static outputChannel: vscode.OutputChannel;

    /**
     * 初始化日志记录器
     */
    static initialize() {
        if (!this.outputChannel) {
            this.outputChannel = vscode.window.createOutputChannel('Git Assistant');
        }
    }

    /**
     * 显示输出面板
     */
    static show() {
        this.initialize();
        this.outputChannel.show();
    }

    /**
     * 隐藏输出面板
     */
    static hide() {
        if (this.outputChannel) {
            this.outputChannel.hide();
        }
    }

    /**
     * 记录信息
     */
    static info(message: string, ...args: any[]) {
        this.initialize();
        const formattedMessage = this.formatMessage('INFO', message, args);
        this.outputChannel.appendLine(formattedMessage);
        console.log(formattedMessage);
    }

    /**
     * 记录警告
     */
    static warn(message: string, ...args: any[]) {
        this.initialize();
        const formattedMessage = this.formatMessage('WARN', message, args);
        this.outputChannel.appendLine(formattedMessage);
        console.warn(formattedMessage);
    }

    /**
     * 记录错误
     */
    static error(message: string, error?: Error, ...args: any[]) {
        this.initialize();
        const formattedMessage = this.formatMessage('ERROR', message, args);
        this.outputChannel.appendLine(formattedMessage);

        if (error) {
            this.outputChannel.appendLine(`  错误详情: ${error.message}`);
            if (error.stack) {
                this.outputChannel.appendLine(`  堆栈追踪:\n${error.stack}`);
            }
        }

        console.error(formattedMessage, error);
    }

    /**
     * 记录调试信息
     */
    static debug(message: string, ...args: any[]) {
        const config = vscode.workspace.getConfiguration('git-assistant');
        const debugMode = config.get('debug', false);

        if (debugMode) {
            this.initialize();
            const formattedMessage = this.formatMessage('DEBUG', message, args);
            this.outputChannel.appendLine(formattedMessage);
            console.debug(formattedMessage);
        }
    }

    /**
     * 格式化消息
     */
    private static formatMessage(level: string, message: string, args: any[]): string {
        const timestamp = new Date().toLocaleTimeString('zh-CN');
        const argsStr = args.length > 0 ? ' ' + JSON.stringify(args) : '';
        return `[${timestamp}] [${level}] ${message}${argsStr}`;
    }

    /**
     * 清空日志
     */
    static clear() {
        if (this.outputChannel) {
            this.outputChannel.clear();
        }
    }

    /**
     * 销毁日志记录器
     */
    static dispose() {
        if (this.outputChannel) {
            this.outputChannel.dispose();
        }
    }
}

