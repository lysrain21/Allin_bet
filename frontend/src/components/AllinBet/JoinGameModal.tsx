"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { getAptosClient } from "@/utils/aptosClient";
import { ABI } from "@/utils/abi";
import { cn } from "@/utils/styling";
import { GameModal } from "./GameModal";
import { PlayingCard } from "@/components/Cards/PlayingCard";

const aptosClient = getAptosClient();

interface JoinGameModalProps {
    isOpen: boolean;
    onClose: () => void;
    gameAddress: string;
    minEntry: number;
}

// Game state enum
type GameState = "input" | "processing" | "first-draw" | "decision" | "processing-continue" | "result" | "joker-fail";

export function JoinGameModal({ isOpen, onClose, gameAddress, minEntry }: JoinGameModalProps) {
    const { account, signAndSubmitTransaction } = useWallet();
    const [entryFee, setEntryFee] = useState<string>(minEntry.toString());
    const [joining, setJoining] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Game state control
    const [gameState, setGameState] = useState<GameState>("input");

    // First card state
    const [firstCard, setFirstCard] = useState<number | null>(null);

    // Final result state
    const [drawnNumbers, setDrawnNumbers] = useState<{
        number1: number;
        number2: number;
        playerProduct: number;
        targetProduct: number;
        isWin: boolean;
    } | null>(null);

    const [result, setResult] = useState<{
        status: "success" | "failure";
        message: string;
    } | null>(null);

    // 添加一个loading状态来控制显示
    const [isLoading, setIsLoading] = useState<boolean>(true);

    // 添加游戏详情状态
    const [gameInfo, setGameInfo] = useState<{
        targetNum1: number;
        targetNum2: number;
        minEntry: number;
        poolValue: number;
    } | null>(null);

    // 修改useEffect - 加载时获取游戏信息
    useEffect(() => {
        if (isOpen) {
            setIsLoading(true);

            // 获取游戏信息
            fetchGameInfo().then(() => {
                // 在获取游戏信息后，检查是否有未完成的游戏
                if (account && gameState !== "input") {
                    return checkPendingGame();
                }
            }).finally(() => {
                setIsLoading(false);
            });
        }
    }, [isOpen, account]);

    // 获取游戏信息
    const fetchGameInfo = async () => {
        try {
            const response = await aptosClient.view({
                payload: {
                    function: `${ABI.address}::allin_bet::get_game_info`,
                    functionArguments: [gameAddress],
                },
            });

            console.log("游戏信息获取成功:", response);

            setGameInfo({
                targetNum1: Number(response[0]),
                targetNum2: Number(response[1]),
                minEntry: Number(response[2]) / 100000000, // 转换为 APT
                poolValue: Number(response[3]) / 100000000, // 转换为 APT
            });
        } catch (err: any) {
            console.error("获取游戏信息失败:", err);
            setError(`无法加载游戏信息: ${err.message || "未知错误"}`);
        }
    };

    // 检查是否有未完成游戏
    const checkPendingGame = async () => {
        try {
            if (!account) {
                return;
            }

            const response = await aptosClient.view({
                payload: {
                    function: `${ABI.address}::allin_bet::get_first_number`,
                    functionArguments: [account.address, gameAddress],
                },
            });

            console.log("检查游戏状态响应:", JSON.stringify(response));

            // 现在函数返回直接的u8值
            if (response && response.length > 0) {
                const cardValue = Number(response[0]);

                // 检查是否为无效值(255表示没有找到pending game)
                if (cardValue !== 255) {
                    console.log("找到玩家的第一张卡牌:", cardValue);
                    setFirstCard(cardValue);
                    setGameState("decision");
                } else {
                    console.log("没有找到玩家的pending game");
                }
            }
        } catch (error) {
            console.error("检查未完成游戏失败:", error);
        }
    };

    // Start game - draw the first card
    const handleJoinGame = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!account) return;

        setJoining(true);
        setError(null);
        setResult(null);
        setGameState("processing");

        try {
            const response = await signAndSubmitTransaction({
                sender: account.address,
                data: {
                    function: `${ABI.address}::allin_bet::join_game`,
                    typeArguments: [],
                    functionArguments: [
                        gameAddress,
                        parseFloat(entryFee) * 1_00000000, // Convert to octas
                    ],
                },
            });

            await aptosClient.waitForTransaction({
                transactionHash: response.hash,
            });

            // 获取交易详情及事件
            const txDetails = await aptosClient.getTransactionByHash({
                transactionHash: response.hash,
            });

            // 从交易详情中获取事件
            const events = txDetails.events || [];

            // 检查是否有GameResult事件（表示第一张牌为Joker，直接失败）
            let gameResultEvent = null;
            for (const event of events) {
                if (event.type?.includes("GameResult")) {
                    gameResultEvent = event;
                    break;
                }
            }

            // 如果找到GameResult事件，说明第一张牌为Joker，直接失败
            if (gameResultEvent && gameResultEvent.data) {
                const { number1, number2, player_product, target_product, is_win } = gameResultEvent.data as any;

                setFirstCard(parseInt(number1)); // 应该为0（Joker）

                // 设置抽取的随机数和结果
                setDrawnNumbers({
                    number1: parseInt(number1),
                    number2: parseInt(number2),
                    playerProduct: parseInt(player_product),
                    targetProduct: parseInt(target_product),
                    isWin: false
                });

                // 设置结果状态
                setResult({
                    status: "failure",
                    message: "抽到了Joker牌！根据游戏规则，您自动失败。"
                });

                setGameState("joker-fail");
                setJoining(false);
                return;
            }

            // 等待一小段时间确保区块链数据已更新
            await new Promise(resolve => setTimeout(resolve, 1000));

            // 确保获取到第一张牌后再更改状态
            const cardValue = await fetchFirstCardValue();
            if (cardValue !== null) {
                setFirstCard(cardValue);
                setGameState("first-draw");
            } else {
                // 如果没有获取到牌值，保持在处理状态
                setError("无法获取牌值，请重试");
                setGameState("input");
            }

        } catch (err: any) {
            setError(err.message || "加入游戏失败");
            setGameState("input");
            console.error(err);
        } finally {
            setJoining(false);
        }
    };

    // 添加一个新函数专门用于获取第一张牌的值
    const fetchFirstCardValue = async (): Promise<number | null> => {
        try {
            if (!account) return null;

            const response = await aptosClient.view({
                payload: {
                    function: `${ABI.address}::allin_bet::get_first_number`,
                    functionArguments: [account.address, gameAddress],
                },
            });

            console.log("从区块链获取的原始响应:", JSON.stringify(response));

            // 简化的解析逻辑，直接获取第一个返回值
            if (response && response.length > 0) {
                const cardValue = Number(response[0]);

                // 检查是否为无效值
                if (cardValue !== 255) {
                    console.log("获取到的卡牌值:", cardValue);
                    return cardValue;
                }
            }

            console.log("未能找到有效的卡牌值");
            return null;
        } catch (error) {
            console.error("获取第一张牌值失败:", error);
            return null;
        }
    };

    // Continue game - draw the second card
    const handleContinueGame = async () => {
        if (!account) return;

        setError(null);
        setGameState("processing-continue");

        try {
            const response = await signAndSubmitTransaction({
                sender: account.address,
                data: {
                    function: `${ABI.address}::allin_bet::continue_game`,
                    typeArguments: [],
                    functionArguments: [
                        gameAddress,
                    ],
                },
            });

            await aptosClient.waitForTransaction({
                transactionHash: response.hash,
            });

            // Get transaction details and events
            const txDetails = await aptosClient.getTransactionByHash({
                transactionHash: response.hash,
            });

            // Extract events from transaction details
            const events = txDetails.events || [];

            // Find GameResult event
            let gameResultEvent = null;
            if (events) {
                for (const event of events) {
                    if (event.type?.includes("GameResult")) {
                        gameResultEvent = event;
                        break;
                    }
                }
            }

            // If event found, parse event data
            if (gameResultEvent && gameResultEvent.data) {
                const { number1, number2, player_product, target_product, is_win } = gameResultEvent.data as any;

                // Set drawn numbers and result
                setDrawnNumbers({
                    number1: parseInt(number1),
                    number2: parseInt(number2),
                    playerProduct: parseInt(player_product),
                    targetProduct: parseInt(target_product),
                    isWin: is_win
                });

                // Set game result
                setResult({
                    status: is_win ? "success" : "failure",
                    message: is_win
                        ? "恭喜你！你赢了！请检查你的钱包余额。"
                        : "很遗憾，这次你没有赢。再试一次！",
                });
            } else {
                // If event not found, use fallback information
                setResult({
                    status: "failure",
                    message: "游戏完成，但无法获取详细结果。请检查你的钱包余额。"
                });
            }

            // 清除第一张牌状态，防止显示重叠
            setFirstCard(null);
            setGameState("result");

            // 更新游戏池信息
            await fetchGameInfo();

        } catch (err: any) {
            setError(err.message || "继续游戏失败");
            setGameState("decision");
            console.error(err);
        }
    };

    // Quit game - refund 40% of the bet
    const handleQuitGame = async () => {
        if (!account) return;

        setError(null);
        setGameState("processing");

        try {
            const response = await signAndSubmitTransaction({
                sender: account.address,
                data: {
                    function: `${ABI.address}::allin_bet::quit_game`,
                    typeArguments: [],
                    functionArguments: [
                        gameAddress,
                    ],
                },
            });

            await aptosClient.waitForTransaction({
                transactionHash: response.hash,
            });

            setResult({
                status: "success",
                message: "您已成功退出游戏并收到40%的退款。",
            });

            setFirstCard(null);
            setGameState("input");

            // 更新游戏池信息
            await fetchGameInfo();

        } catch (err: any) {
            setError(err.message || "退出游戏失败");
            setGameState("decision");
            console.error(err);
        }
    };

    // Reset game
    const handleReset = () => {
        setFirstCard(null);
        setDrawnNumbers(null);
        setResult(null);
        setError(null);
        setGameState("input");
    };

    // Helper function to convert numbers to card names
    const getCardName = (value: number): string => {
        if (value === 0) return "Joker";
        if (value === 1) return "A (1)";
        if (value >= 2 && value <= 10) return value.toString();
        if (value === 11) return "J (11)";
        if (value === 12) return "Q (12)";
        if (value === 13) return "K (13)";
        return "未知";
    };

    // 在renderGameContent中处理loading状态
    const renderGameContent = () => {
        if (isLoading) {
            return (
                <div className="flex flex-col items-center justify-center py-8">
                    <div className="mb-4 text-center">
                        <i className="nes-icon coin is-large animate-bounce"></i>
                    </div>
                    <p className="mb-4 text-lg">加载游戏数据中...</p>
                    <div className="nes-progress w-full max-w-md">
                        <progress className="nes-progress is-primary" value="70" max="100"></progress>
                    </div>
                </div>
            );
        }

        switch (gameState) {
            case "input":
                return (
                    <div className="bg-gradient-to-b from-gray-800 to-gray-900 rounded-lg p-6 border-2 border-yellow-400 shadow-lg">
                        <form onSubmit={handleJoinGame} className="flex flex-col gap-6">
                            <div className="nes-field">
                                <label htmlFor="entry-fee" className="text-yellow-300 mb-2 block font-bold">入场费 (APT)</label>
                                <div className="relative">
                                    <input
                                        id="entry-fee"
                                        type="number"
                                        className="nes-input is-dark w-full border-yellow-400"
                                        step="0.1"
                                        min={minEntry}
                                        value={entryFee}
                                        onChange={(e) => setEntryFee(e.target.value)}
                                        required
                                    />
                                    <span className="absolute right-3 top-2 text-yellow-300">APT</span>
                                </div>
                                <p className="mt-2 text-xs text-yellow-200">*最低入场费: {minEntry} APT</p>
                            </div>

                            {error && (
                                <div className="nes-container is-error p-3">
                                    <p className="text-sm">{error}</p>
                                </div>
                            )}

                            <div className="flex justify-center">
                                <button
                                    type="submit"
                                    className={cn(
                                        "nes-btn is-primary px-8 py-2 transition transform hover:scale-105",
                                        joining && "is-disabled cursor-not-allowed"
                                    )}
                                    disabled={joining}
                                >
                                    {joining ?
                                        <span className="flex items-center">
                                            <i className="nes-icon is-small star mr-2 animate-pulse"></i>
                                            加入中...
                                        </span> :
                                        <span className="flex items-center">
                                            <i className="nes-icon is-small coin mr-2"></i>
                                            加入游戏
                                        </span>
                                    }
                                </button>
                            </div>
                        </form>
                    </div>
                );

            case "processing":
                return (
                    <div className="flex flex-col items-center gap-6 py-8">
                        <div className="relative">
                            <PlayingCard value={null} size="large" />
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="animate-ping absolute inline-flex h-12 w-12 rounded-full bg-yellow-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-8 w-8 bg-yellow-500"></span>
                            </div>
                        </div>
                        <p className="text-lg">正在支付入场费并抽取第一张牌...</p>
                        <div className="nes-progress is-pattern w-full max-w-md">
                            <progress className="nes-progress is-primary" value="70" max="100"></progress>
                        </div>
                        <p className="text-sm text-gray-400">交易正在区块链上确认中，这可能需要几秒钟时间</p>
                    </div>
                );

            case "first-draw":
            case "decision":
                return (
                    <div className="flex flex-col gap-6">
                        <div className="nes-container is-dark with-title p-4 bg-gradient-to-br from-gray-700 to-gray-900 border-2 border-yellow-400">
                            <p className="title bg-yellow-600 px-2">您的第一张卡牌</p>
                            <div className="flex justify-center mb-6 mt-4">
                                <div className="transform hover:scale-105 transition-transform duration-300">
                                    {firstCard !== null ? (
                                        <div className="flex flex-col items-center">
                                            <div className="mb-2 relative">
                                                <PlayingCard value={firstCard} size="large" />
                                                <div className="absolute -top-3 -right-3 bg-yellow-400 text-black rounded-full h-8 w-8 flex items-center justify-center font-bold">
                                                    {firstCard}
                                                </div>
                                            </div>
                                            <div className="mt-2 px-4 py-1 bg-yellow-600 rounded-full text-white text-sm">
                                                {getCardName(firstCard)}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="w-24 h-36 flex items-center justify-center bg-gray-700 rounded-md border-2 border-white animate-pulse">
                                            <span>等待...</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="nes-container is-rounded is-dark mb-4 p-3">
                                <p className="text-center text-yellow-200">
                                    决定时刻! 继续抽第二张牌还是现在就退出?
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mt-4">
                                <button
                                    className="nes-btn is-primary flex items-center justify-center"
                                    onClick={handleContinueGame}
                                    disabled={firstCard === null || gameState === "processing"}
                                >
                                    <i className="nes-icon trophy mr-2"></i>
                                    继续游戏
                                </button>
                                <button
                                    className="nes-btn is-error flex items-center justify-center"
                                    onClick={handleQuitGame}
                                    disabled={firstCard === null || gameState === "processing"}
                                >
                                    <i className="nes-icon close mr-2"></i>
                                    退出(退还40%)
                                </button>
                            </div>
                        </div>

                        {error && (
                            <div className="nes-container is-error">
                                <p>{error}</p>
                            </div>
                        )}
                    </div>
                );

            case "processing-continue":
                return (
                    <div className="flex flex-col items-center gap-6 py-8">
                        <div className="flex items-center gap-10">
                            <div className="relative">
                                <PlayingCard value={firstCard || 0} size="large" />
                            </div>
                            <div className="text-2xl">+</div>
                            <div className="relative">
                                <PlayingCard value={null} size="large" className="animate-pulse" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="animate-ping absolute inline-flex h-10 w-10 rounded-full bg-yellow-400 opacity-75"></span>
                                </div>
                            </div>
                        </div>

                        <p className="text-lg">正在抽取第二张牌...</p>
                        <div className="nes-progress is-pattern w-full max-w-md">
                            <progress className="nes-progress is-primary" value="70" max="100"></progress>
                        </div>
                        <p className="text-sm text-gray-400">交易正在区块链上确认中，这可能需要几秒钟时间</p>
                    </div>
                );

            case "result":
                return (
                    <div className="flex flex-col gap-6">
                        {result && (
                            <div
                                className={`nes-container ${result.status === "success" ? "is-success" : "is-error"} p-4`}
                            >
                                <div className="flex items-center">
                                    <i className={`nes-icon ${result.status === "success" ? "trophy" : "heart empty"} mr-3`}></i>
                                    <p className="font-bold">{result.message}</p>
                                </div>
                            </div>
                        )}

                        {drawnNumbers && (
                            <div className="nes-container is-dark with-title bg-gradient-to-br from-gray-700 to-gray-900 border-2 border-indigo-400">
                                <p className="title bg-indigo-600 px-2">游戏结果</p>
                                <div className="flex flex-col items-center mt-4">
                                    <div className="flex justify-center items-center gap-2 mb-6">
                                        <div className="transform transition-all duration-300 hover:scale-110">
                                            <PlayingCard value={drawnNumbers.number1} size="large" />
                                            <div className="mt-1 text-center">
                                                {getCardName(drawnNumbers.number1)}
                                            </div>
                                        </div>
                                        <div className="text-2xl font-bold mx-2">×</div>
                                        <div className="transform transition-all duration-300 hover:scale-110">
                                            <PlayingCard value={drawnNumbers.number2} size="large" />
                                            <div className="mt-1 text-center">
                                                {getCardName(drawnNumbers.number2)}
                                            </div>
                                        </div>
                                        <div className="text-2xl font-bold mx-2">=</div>
                                        <div className="flex flex-col items-center">
                                            <div className="h-24 w-24 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-center">
                                                <span className="text-3xl font-bold">{drawnNumbers.playerProduct}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 w-full max-w-md bg-gray-800 p-4 rounded-lg mb-4">
                                        <div className="text-right text-gray-300">您的乘积:</div>
                                        <div className="font-bold text-white">{drawnNumbers.playerProduct}</div>
                                        <div className="text-right text-gray-300">目标乘积:</div>
                                        <div className="font-bold text-white">{drawnNumbers.targetProduct}</div>
                                    </div>

                                    <div className={`nes-container ${drawnNumbers.isWin ? 'is-success' : 'is-error'} w-full p-3 mb-4`}>
                                        {drawnNumbers.isWin ? (
                                            <div className="flex items-center justify-center">
                                                <i className="nes-icon trophy mr-2"></i>
                                                <p className="font-bold">您的乘积大于目标乘积，胜利！</p>
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-center">
                                                <i className="nes-icon heart empty mr-2"></i>
                                                <p className="font-bold">您的乘积小于或等于目标乘积，很遗憾！</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="flex gap-4 mt-2">
                            <button className="nes-btn is-primary flex-1 flex items-center justify-center" onClick={onClose}>
                                <i className="nes-icon close mr-2"></i>
                                关闭
                            </button>
                            <button
                                className="nes-btn is-warning flex-1 flex items-center justify-center"
                                onClick={handleReset}
                            >
                                <i className="nes-icon coin mr-2"></i>
                                再玩一次
                            </button>
                        </div>
                    </div>
                );

            case "joker-fail":
                return (
                    <div className="flex flex-col gap-6 relative overflow-hidden">
                        {/* 小丑粒子效果 - 背景装饰 */}
                        <div className="joker-particles absolute inset-0 pointer-events-none" id="joker-particles">
                            {Array.from({ length: 20 }).map((_, i) => (
                                <div key={i} className="joker-emoji" style={{
                                    left: `${Math.random() * 100}%`,
                                    animationDelay: `${Math.random() * 2}s`,
                                    animationDuration: `${3 + Math.random() * 4}s`
                                }}>
                                    {Math.random() > 0.5 ? '🃏' : '🤡'}
                                </div>
                            ))}
                        </div>

                        <div className="nes-container is-error with-title p-4 bg-gradient-to-br from-gray-700 to-gray-900 border-2 border-red-500 z-10 relative">
                            <p className="title bg-red-600 px-2 text-white font-bold animate-pulse">GAME OVER</p>

                            {/* 旋转的大小丑牌 */}
                            <div className="flex justify-center mb-6 mt-4">
                                <div className="transform hover:scale-110 transition-transform duration-300 joker-card-spin">
                                    <div className="flex flex-col items-center relative">
                                        <div className="mb-2 relative joker-glow">
                                            <PlayingCard value={0} size="large" />
                                            <div className="absolute -inset-4 bg-red-500 opacity-20 blur-xl rounded-full pulse-glow"></div>
                                        </div>
                                        <div className="mt-2 px-4 py-1 bg-red-600 rounded-full text-white text-sm joker-badge-wobble">
                                            Joker 小丑牌
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 闪烁的失败消息 */}
                            <div className="nes-container is-error mb-4 p-3 joker-message-shake">
                                <div className="flex items-center justify-center">
                                    <i className="nes-icon close mr-2"></i>
                                    <p className="font-bold text-lg">哈哈哈！小丑牌选中了你！游戏结束！</p>
                                </div>
                            </div>

                            {/* 嘲讽性语录轮播 */}
                            <div className="joker-quotes mb-4 p-2 bg-black rounded-lg">
                                <p className="text-yellow-300 text-center font-pixel animate-bounce">
                                    "有时候，运气就是这么差~"
                                </p>
                            </div>

                            <div className="flex gap-4 mt-4">
                                <button
                                    className="nes-btn is-primary flex-1 flex items-center justify-center relative overflow-hidden"
                                    onClick={onClose}
                                >
                                    <span className="z-10 relative flex items-center">
                                        <i className="nes-icon close mr-2"></i>
                                        关闭
                                    </span>
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent shimmer-effect"></div>
                                </button>
                                <button
                                    className="nes-btn is-warning flex-1 flex items-center justify-center animate-pulse"
                                    onClick={handleReset}
                                >
                                    <i className="nes-icon coin mr-2"></i>
                                    再来一次！
                                </button>
                            </div>
                        </div>

                        {/* 浮动的讽刺表情 */}
                        <div className="absolute right-4 top-10 floating-emoji">
                            <span className="text-4xl">😂</span>
                        </div>
                        <div className="absolute left-4 bottom-10 floating-emoji" style={{ animationDelay: "1.5s" }}>
                            <span className="text-4xl">🤣</span>
                        </div>
                    </div>
                );
        }
    };

    return (
        <GameModal isOpen={isOpen} onClose={onClose} title="加入游戏">
            <div className="flex flex-col gap-5">
                <div className="nes-container is-dark with-title bg-gradient-to-r from-gray-800 to-gray-900 border-2 border-purple-500 shadow-lg">
                    <p className="title bg-purple-600 px-3">游戏信息</p>
                    <div className="text-xs mb-3 text-gray-400 bg-gray-800 p-2 rounded overflow-hidden">
                        <span className="font-bold text-purple-300">游戏地址: </span>
                        <span className="break-all">{gameAddress}</span>
                    </div>

                    {gameInfo ? (
                        <div className="bg-gray-800 rounded-lg p-3">
                            <h4 className="text-center text-purple-300 mb-3 font-bold">游戏目标</h4>
                            <div className="flex justify-center gap-3 mb-4 bg-gray-900 p-3 rounded-lg">
                                <div className="flex flex-col items-center">
                                    <PlayingCard value={gameInfo.targetNum1} size="small" className="transition transform hover:scale-110" />
                                    <span className="mt-1 text-sm">{getCardName(gameInfo.targetNum1)}</span>
                                </div>
                                <div className="text-xl flex items-center">×</div>
                                <div className="flex flex-col items-center">
                                    <PlayingCard value={gameInfo.targetNum2} size="small" className="transition transform hover:scale-110" />
                                    <span className="mt-1 text-sm">{getCardName(gameInfo.targetNum2)}</span>
                                </div>
                                <div className="text-xl flex items-center">=</div>
                                <div className="flex flex-col items-center">
                                    <div className="h-12 w-12 rounded-full bg-purple-600 flex items-center justify-center">
                                        <span className="text-xl font-bold">{gameInfo.targetNum1 * gameInfo.targetNum2}</span>
                                    </div>
                                </div>
                            </div>

                            <p className="text-sm text-center mb-4 text-yellow-200 bg-gray-900 p-2 rounded-lg">
                                抽取的两张牌乘积需大于 <span className="font-bold">{gameInfo.targetNum1 * gameInfo.targetNum2}</span> 才能赢!
                            </p>

                            <div className="grid grid-cols-2 gap-2 bg-gray-900 p-3 rounded-lg">
                                <div className="text-right text-gray-300">最低入场费:</div>
                                <div className="font-bold flex items-center">
                                    <i className="nes-icon coin is-small mr-1"></i>
                                    <span>{gameInfo.minEntry.toFixed(2)} APT</span>
                                </div>
                                <div className="text-right text-gray-300">当前奖池:</div>
                                <div className="font-bold text-yellow-300 flex items-center">
                                    <i className="nes-icon coin is-small mr-1"></i>
                                    <span>{gameInfo.poolValue.toFixed(2)} APT</span>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <p className="flex items-center">
                            <i className="nes-icon coin is-small mr-2"></i>
                            最低入场费: {minEntry} APT
                        </p>
                    )}
                </div>

                {renderGameContent()}
            </div>
        </GameModal>
    );
}