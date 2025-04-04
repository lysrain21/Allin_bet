"use client";

import { useState, useEffect } from "react";
import { getAptosClient } from "@/utils/aptosClient";
import { ABI } from "@/utils/abi";
import { GameInfo } from "./GameInfo";
import { JoinGameModal } from "./JoinGameModal";
import { FaGamepad, FaSpinner, FaExclamationTriangle } from "react-icons/fa";

const aptosClient = getAptosClient();

export function GamesList() {
    const [gameAddresses, setGameAddresses] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedGame, setSelectedGame] = useState<{
        address: string;
        minEntry: number;
    } | null>(null);

    useEffect(() => {
        const fetchAllGamePools = async () => {
            try {
                setLoading(true);
                setError(null);

                // 直接硬编码一些测试地址，在合约修复前临时使用
                const hardcodedAddresses: string[] = [
                    // 如果您已经创建了游戏池，请在这里添加它们的地址
                ];

                try {
                    // 尝试调用合约方法获取地址
                    const response = await aptosClient.view({
                        payload: {
                            function: `${ABI.address}::allin_bet::get_all_game_pools`,
                            functionArguments: [],
                        },
                    });

                    // 如果成功，使用返回的地址
                    const addresses = response[0] as string[];
                    setGameAddresses(addresses);
                } catch (err: any) {
                    console.warn("无法从合约获取游戏池列表:", err);

                    // 如果合约调用失败，使用硬编码地址
                    if (hardcodedAddresses.length > 0) {
                        setGameAddresses(hardcodedAddresses);
                        setError("已使用预配置的游戏地址。要添加新游戏，请手动更新地址列表。");
                    } else {
                        setError("游戏系统尚未完全初始化。请先创建一个游戏池。");
                        setGameAddresses([]);
                    }
                }
            } finally {
                setLoading(false);
            }
        };

        fetchAllGamePools();
    }, []);

    // 打开游戏参与模态框
    const openJoinModal = async (gameAddress: string) => {
        try {
            // 获取游戏信息以确定最低入场费
            const gameInfo = await aptosClient.view({
                payload: {
                    function: `${ABI.address}::allin_bet::get_game_info`,
                    functionArguments: [gameAddress],
                },
            });

            // 设置选中的游戏
            setSelectedGame({
                address: gameAddress,
                minEntry: Number(gameInfo[2]) / 100000000, // 转换为 APT
            });
        } catch (err) {
            console.error("获取游戏信息失败:", err);
        }
    };

    // 关闭模态框
    const closeJoinModal = () => {
        setSelectedGame(null);
    };

    if (loading) {
        return (
            <div className="nes-container is-dark p-8 max-w-4xl mx-auto">
                <div className="flex flex-col items-center justify-center space-y-4 py-12">
                    <div className="nes-icon is-large star animate-pulse"></div>
                    <p className="nes-text is-primary text-lg">正在加载游戏列表...</p>
                    <div className="w-full h-4 nes-progress is-primary">
                        <progress className="nes-progress is-primary" value="70" max="100"></progress>
                    </div>
                </div>
            </div>
        );
    }

    if (gameAddresses.length === 0) {
        return (
            <div className="nes-container is-dark p-8 max-w-4xl mx-auto">
                <div className="flex flex-col items-center justify-center py-12">
                    <div className="nes-icon is-large heart mb-4 animate-bounce"></div>
                    <p className="nes-text is-error text-center text-lg mb-4">
                        {error || "当前没有可用的游戏"}
                    </p>
                    <p className="text-center">请先创建一个游戏池</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6 max-w-5xl mx-auto">
            {error && (
                <div className="nes-container is-warning p-4 border-4 shadow-lg">
                    <div className="flex items-center space-x-3">
                        <FaExclamationTriangle className="text-yellow-600" />
                        <p>{error}</p>
                    </div>
                </div>
            )}
            <div className="nes-container is-dark with-title border-4 shadow-2xl">
                <p className="title bg-gray-900 px-4 py-1 flex items-center">
                    <FaGamepad className="mr-2" /> 可用游戏
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                    {gameAddresses.map((address) => (
                        <div
                            key={address}
                            className="nes-container is-rounded border-4 bg-gray-800 hover:bg-gray-700 transition-colors duration-300 shadow-lg"
                        >
                            <div className="mb-4 bg-gray-900 p-2 rounded">
                                <p className="text-xs md:text-sm break-all font-mono text-green-400">
                                    <span className="text-yellow-400 mr-1">游戏ID:</span>
                                    <span className="select-all">{address.slice(0, 10)}...{address.slice(-10)}</span>
                                    <button
                                        className="nes-btn is-small is-primary float-right px-1 py-0"
                                        onClick={() => navigator.clipboard.writeText(address)}
                                        title="复制地址"
                                    >
                                        复制
                                    </button>
                                </p>
                            </div>

                            <div className="bg-gray-900/30 p-3 rounded">
                                <GameInfo gameAddress={address} />
                            </div>

                            <div className="mt-4 flex justify-center">
                                <button
                                    className="nes-btn is-primary is-large px-6 py-2 hover:brightness-110 transition-all duration-200"
                                    onClick={() => openJoinModal(address)}
                                >
                                    加入游戏
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* 加入游戏模态框 */}
            {selectedGame && (
                <JoinGameModal
                    isOpen={!!selectedGame}
                    onClose={closeJoinModal}
                    gameAddress={selectedGame.address}
                    minEntry={selectedGame.minEntry}
                />
            )}
        </div>
    );
}