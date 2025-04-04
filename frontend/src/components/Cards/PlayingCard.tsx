"use client";

import { cn } from "@/utils/styling";
import { useState, useEffect } from "react";

// 定义扑克牌花色的符号和颜色
const SUITS = {
    spade: { symbol: "♠", color: "text-black" },
    heart: { symbol: "♥", color: "text-red-600" },
    diamond: { symbol: "♦", color: "text-red-600" },
    club: { symbol: "♣", color: "text-black" },
};

interface PlayingCardProps {
    value: number; // 0-13，其中0为Joker，1为Ace，11-13为J,Q,K
    className?: string;
    suit?: "spade" | "heart" | "diamond" | "club"; // 可选的花色属性
    size?: "small" | "medium" | "large"; // 添加尺寸属性
}

export function PlayingCard({ value, className, suit = "spade" }: PlayingCardProps) {
    const [valueStr, setValueStr] = useState<string>("?");
    const [cardTheme, setCardTheme] = useState<{
        bgGradient: string;
        borderColor: string;
        shadow: string;
    }>({
        bgGradient: "bg-gradient-to-br from-gray-700 to-gray-900",
        borderColor: "border-gray-400",
        shadow: "shadow-gray-700/50",
    });
    const [suitInfo, setSuitInfo] = useState(SUITS.spade);

    useEffect(() => {
        // 设置花色信息
        if (suit && SUITS[suit]) {
            setSuitInfo(SUITS[suit]);
        }

        // 设置卡牌上显示的值和主题
        if (value === 0) {
            setValueStr("🃏");
            setCardTheme({
                bgGradient: "bg-gradient-to-br from-purple-600 to-purple-900",
                borderColor: "border-purple-300",
                shadow: "shadow-purple-700/50",
            });
        } else if (value === 1) {
            setValueStr("A");
            setCardTheme({
                bgGradient: "bg-gradient-to-br from-red-600 to-red-900",
                borderColor: "border-red-300",
                shadow: "shadow-red-700/50",
            });
        } else if (value >= 2 && value <= 10) {
            setValueStr(value.toString());
            setCardTheme({
                bgGradient: "bg-gradient-to-br from-blue-600 to-blue-900",
                borderColor: "border-blue-300",
                shadow: "shadow-blue-700/50",
            });
        } else if (value === 11) {
            setValueStr("J");
            setCardTheme({
                bgGradient: "bg-gradient-to-br from-green-600 to-green-900",
                borderColor: "border-green-300",
                shadow: "shadow-green-700/50",
            });
        } else if (value === 12) {
            setValueStr("Q");
            setCardTheme({
                bgGradient: "bg-gradient-to-br from-amber-600 to-amber-900",
                borderColor: "border-amber-300",
                shadow: "shadow-amber-700/50",
            });
        } else if (value === 13) {
            setValueStr("K");
            setCardTheme({
                bgGradient: "bg-gradient-to-br from-orange-600 to-orange-900",
                borderColor: "border-orange-300",
                shadow: "shadow-orange-700/50",
            });
        } else {
            setValueStr("?");
            setCardTheme({
                bgGradient: "bg-gradient-to-br from-gray-700 to-gray-900",
                borderColor: "border-gray-400",
                shadow: "shadow-gray-700/50",
            });
        }
    }, [value, suit]);

    return (
        <div
            className={cn(
                "w-16 h-24 rounded-lg flex items-center justify-center",
                "transition-all duration-300 hover:scale-105",
                "relative overflow-hidden",
                "border-2",
                cardTheme.borderColor,
                cardTheme.bgGradient,
                `shadow-lg ${cardTheme.shadow}`,
                className
            )}
        >
            {/* 左上角的值和花色 */}
            {value !== 0 && (
                <div className="absolute top-1 left-1 flex flex-col items-center">
                    <span className="text-sm font-bold text-white">{valueStr}</span>
                    <span className={cn("text-sm", suitInfo.color)}>{suitInfo.symbol}</span>
                </div>
            )}

            {/* 中央大号值 */}
            <div className="flex flex-col items-center justify-center">
                <span className={cn(
                    "text-2xl font-extrabold",
                    value === 0 ? "text-3xl" : "text-white"
                )}>
                    {valueStr}
                </span>

                {/* 中央花色 - 只对普通牌显示 */}
                {value !== 0 && (
                    <span className={cn("text-2xl", suitInfo.color)}>{suitInfo.symbol}</span>
                )}
            </div>

            {/* 右下角的值和花色 */}
            {value !== 0 && (
                <div className="absolute bottom-1 right-1 flex flex-col items-center rotate-180">
                    <span className="text-sm font-bold text-white">{valueStr}</span>
                    <span className={cn("text-sm", suitInfo.color)}>{suitInfo.symbol}</span>
                </div>
            )}

            {/* 纹理叠加层 */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none"></div>
        </div>
    );
}