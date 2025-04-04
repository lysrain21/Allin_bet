"use client";

export function NotConnected() {
  return (
    <div className="flex flex-col gap-6 p-6 h-full overflow-auto">
      <div className="flex justify-center items-center h-40">
        <div className="text-6xl animate-pulse">🎲</div>
      </div>
      <div className="nes-container is-dark with-title">
        <p className="title">欢迎来到 AllinBet</p>
        <p>连接您的钱包以创建或参与投注游戏。抽取两张卡牌，如果乘积高于平台的目标值，就能赢得奖金！</p>
      </div>
      <div className="nes-container with-title">
        <p className="title">游戏规则</p>
        <ul className="list-disc pl-5 space-y-2">
          <li>连接您的 Aptos 钱包</li>
          <li>创建游戏池或加入现有游戏</li>
          <li>加入游戏时，您将首先抽取第一张卡牌</li>
          <li><span className="text-red-500 font-bold">特殊规则：</span>如果您抽到Joker(0)，游戏将直接结束，您将失败！</li>
          <li>如果第一张卡牌不是Joker，您可以选择继续游戏或退出（退出将返还40%的下注）</li>
          <li>如果继续，您将抽取第二张卡牌</li>
          <li>如果您两张卡牌的乘积高于平台的目标乘积，您将赢得奖池的20%！</li>
        </ul>
      </div>
    </div>
  );
}