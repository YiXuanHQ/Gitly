import * as vscode from 'vscode';
import { Logger } from './logger';

/**
 * 通知工具类
 */
export class Notification {
    /**
     * 显示信息通知
     */
    static info(message: string, ...actions: string[]): Thenable<string | undefined> {
        Logger.info(message);
        return vscode.window.showInformationMessage(message, ...actions);
    }

    /**
     * 显示警告通知
     */
    static warn(message: string, ...actions: string[]): Thenable<string | undefined> {
        Logger.warn(message);
        return vscode.window.showWarningMessage(message, ...actions);
    }

    /**
     * 显示错误通知
     */
    static error(message: string, error?: Error, ...actions: string[]): Thenable<string | undefined> {
        Logger.error(message, error);
        return vscode.window.showErrorMessage(message, ...actions);
    }

    /**
     * 显示成功通知（带图标）
     */
    static success(message: string, ...actions: string[]): Thenable<string | undefined> {
        Logger.info(message);
        return vscode.window.showInformationMessage(`✅ ${message}`, ...actions);
    }

    /**
     * 显示进度通知
     */
    static async withProgress<T>(
        title: string,
        task: (progress: vscode.Progress<{ increment?: number; message?: string }>) => Promise<T>
    ): Promise<T> {
        return vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title,
                cancellable: false
            },
            async (progress) => {
                Logger.info(`开始: ${title}`);
                try {
                    const result = await task(progress);
                    Logger.info(`完成: ${title}`);
                    return result;
                } catch (error) {
                    Logger.error(`失败: ${title}`, error as Error);
                    throw error;
                }
            }
        );
    }

    /**
     * 显示可取消的进度通知
     */
    static async withCancellableProgress<T>(
        title: string,
        task: (
            progress: vscode.Progress<{ increment?: number; message?: string }>,
            token: vscode.CancellationToken
        ) => Promise<T>
    ): Promise<T> {
        return vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title,
                cancellable: true
            },
            async (progress, token) => {
                Logger.info(`开始: ${title}`);

                token.onCancellationRequested(() => {
                    Logger.warn(`已取消: ${title}`);
                });

                try {
                    const result = await task(progress, token);
                    Logger.info(`完成: ${title}`);
                    return result;
                } catch (error) {
                    Logger.error(`失败: ${title}`, error as Error);
                    throw error;
                }
            }
        );
    }

    /**
     * 显示确认对话框
     */
    static async confirm(
        message: string,
        confirmText: string = '确认',
        cancelText: string = '取消'
    ): Promise<boolean> {
        const choice = await vscode.window.showWarningMessage(
            message,
            { modal: true },
            confirmText
        );
        return choice === confirmText;
    }

    /**
     * 显示输入框
     */
    static async input(
        prompt: string,
        placeHolder?: string,
        validateInput?: (value: string) => string | null
    ): Promise<string | undefined> {
        return vscode.window.showInputBox({
            prompt,
            placeHolder,
            validateInput: validateInput ? (value) => validateInput(value) || undefined : undefined
        });
    }

    /**
     * 显示快速选择
     */
    static async pick<T extends vscode.QuickPickItem>(
        items: T[],
        placeHolder?: string
    ): Promise<T | undefined> {
        return vscode.window.showQuickPick(items, {
            placeHolder
        });
    }

    /**
     * 显示多选快速选择
     */
    static async pickMultiple<T extends vscode.QuickPickItem>(
        items: T[],
        placeHolder?: string
    ): Promise<T[] | undefined> {
        return vscode.window.showQuickPick(items, {
            placeHolder,
            canPickMany: true
        });
    }
}

