import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { BookOpenText, Brain, ClipboardList, FileText, Keyboard, Mic, MousePointerClick, Shield, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import ClickSpark from "@/components/ClickSpark";
import { loadDashboardFirstUseGuideState, markDashboardFirstUseGuideSeen } from "@/features/dashboard/home/dashboardHomeOnboarding";
import { dashboardDecorOrbs, dashboardEntranceOrbs, dashboardModuleColors } from "@/features/dashboard/home/dashboardHome.config";
import { getDashboardHomeFallbackData, type DashboardHomeData } from "@/features/dashboard/home/dashboardHome.service";
import type { DashboardHomeEventStateKey, DashboardHomeModuleKey, DashboardHomeSummonEvent } from "@/features/dashboard/home/dashboardHome.types";
import { DashboardCenterOrb } from "@/features/dashboard/home/components/DashboardCenterOrb";
import { DashboardDecorOrb } from "@/features/dashboard/home/components/DashboardDecorOrb";
import { DashboardEntranceOrb } from "@/features/dashboard/home/components/DashboardEntranceOrb";
import { DashboardEventOrb } from "@/features/dashboard/home/components/DashboardEventOrb";
import { DashboardEventPanel } from "@/features/dashboard/home/components/DashboardEventPanel";
import { DashboardOrbitRings } from "@/features/dashboard/home/components/DashboardOrbitRings";
import { resolveDashboardModuleRoutePath } from "@/features/dashboard/shared/dashboardRouteTargets";
import { cn } from "@/utils/cn";
import "@/features/shell-ball/shellBall.css";
import "@/features/dashboard/home/dashboardHome.css";

function getRouteForModule(module: DashboardHomeModuleKey) {
  return resolveDashboardModuleRoutePath(module);
}

function getCenterState(activeStateKey: DashboardHomeEventStateKey | null) {
  if (!activeStateKey) {
    return "idle" as const;
  }

  if (activeStateKey.startsWith("task_error") || activeStateKey === "safety_alert") {
    return "waiting_auth" as const;
  }

  if (activeStateKey === "task_working" || activeStateKey === "notes_processing") {
    return "processing" as const;
  }

  if (activeStateKey === "task_completing") {
    return "confirming_intent" as const;
  }

  return "hover_input" as const;
}

type DashboardFirstUseGuideItem = {
  copy: string;
  icon: typeof Sparkles;
  title: string;
};

const dashboardFirstUseQuickStart: DashboardFirstUseGuideItem[] = [
  {
    copy: "适合总结当前页面、解释报错、直接问下一步，不需要先写长 prompt。",
    icon: Mic,
    title: "长按中心球，说一句自然话",
  },
  {
    copy: "选中文本、悬停补一句、或把文件拖到悬浮球，都算围绕当前现场继续发起。",
    icon: MousePointerClick,
    title: "围绕现场对象继续发起协作",
  },
  {
    copy: "当你要回看任务、成果、安全边界或记忆时，再进入完整工作台接管。",
    icon: ClipboardList,
    title: "双击悬浮球，再在仪表盘里接管",
  },
];

const dashboardFirstUseScenarios: DashboardFirstUseGuideItem[] = [
  {
    copy: "对网页、文档、代码片段快速提炼要点。",
    icon: FileText,
    title: "总结当前页面 / 文档 / 代码片段",
  },
  {
    copy: "围绕一小段内容做翻译、解释、润色或延展。",
    icon: BookOpenText,
    title: "处理选中内容而不是整页重聊",
  },
  {
    copy: "把终端报错、异常页面或卡住的任务转成原因分析与下一步建议。",
    icon: Sparkles,
    title: "分析报错并给出下一步",
  },
];

const dashboardFirstUseWorkbench: DashboardFirstUseGuideItem[] = [
  {
    copy: "看当前任务推进到哪一步、产出了什么、为什么卡住。",
    icon: ClipboardList,
    title: "任务",
  },
  {
    copy: "看近期要做、后续安排和重复事项，决定哪些该转成正式任务。",
    icon: FileText,
    title: "便签",
  },
  {
    copy: "看总结、习惯洞察和最近命中的长期记忆。",
    icon: Brain,
    title: "镜子",
  },
  {
    copy: "看授权、审计和恢复点，确保越界动作始终可解释、可撤回。",
    icon: Shield,
    title: "安全",
  },
];

type DashboardHomeProps = {
  data?: DashboardHomeData;
  onVoiceOpen: () => void;
  onRecommendationFeedback?: (recommendationId: string, feedback: "positive" | "negative") => void;
  voiceOpen: boolean;
};

/**
 * Renders the dashboard home route, including the local first-use guide that
 * explains how desktop users should start from the floating-ball workflow.
 *
 * @param props Home data and voice/recommendation callbacks.
 * @returns The dashboard home screen.
 */
export function DashboardHome({
  data = getDashboardHomeFallbackData(),
  onVoiceOpen,
  onRecommendationFeedback,
  voiceOpen,
}: DashboardHomeProps) {
  const navigate = useNavigate();
  // The onboarding guide is a desktop-local view concern. Keep it outside
  // formal task or dashboard RPC state so it never leaks into business data.
  const [firstUseGuideState] = useState(() => loadDashboardFirstUseGuideState());
  const [orbDragOffset, setOrbDragOffset] = useState({ x: 0, y: 0 });
  const [hoveredEntranceKey, setHoveredEntranceKey] = useState<string | null>(null);
  const [activeStateKey, setActiveStateKey] = useState<DashboardHomeEventStateKey | null>(null);
  const [hasSeenFirstUseGuide, setHasSeenFirstUseGuide] = useState(() => !firstUseGuideState.shouldShow);
  const [isFirstUseGuideOpen, setIsFirstUseGuideOpen] = useState(() => firstUseGuideState.shouldShow);
  const [summons, setSummons] = useState<DashboardHomeSummonEvent[]>([]);
  const firstUsePrimaryActionRef = useRef<HTMLButtonElement | null>(null);
  const summonIndexRef = useRef(0);
  const summonIdRef = useRef(0);
  const summonTimerRef = useRef<number | null>(null);

  const activeState = activeStateKey ? data.stateMap[activeStateKey] : null;
  const activeModule = hoveredEntranceKey
    ? dashboardEntranceOrbs.find((config) => config.key === hoveredEntranceKey)?.module ?? activeState?.module ?? null
    : activeState?.module ?? null;
  const activeModuleColor = activeModule ? dashboardModuleColors[activeModule].color : null;
  const currentFocusLine = activeState?.headline ?? summons[0]?.message ?? data.focusLine.headline;
  const currentReasonLine = activeState?.subline ?? summons[0]?.reason ?? data.focusLine.reason;
  const isOverlayOpen = Boolean(activeState || voiceOpen || isFirstUseGuideOpen);
  const guideTriggerLabel = hasSeenFirstUseGuide ? "重新查看说明" : "第一次怎么用";

  const scheduleSummon = useCallback(() => {
    const template = data.summonTemplates[summonIndexRef.current % data.summonTemplates.length];
    summonIndexRef.current += 1;

    setSummons((current) => {
      if (current.length >= 1) {
        return current;
      }

      return [
        ...current,
        {
          ...template,
          id: `summon-${++summonIdRef.current}`,
        },
      ];
    });

    const gap = (template.duration ?? 5_000) + 7_000;
    summonTimerRef.current = window.setTimeout(scheduleSummon, gap);
  }, [data.summonTemplates]);

  useEffect(() => {
    summonIndexRef.current = 0;
    summonIdRef.current = 0;
    setSummons([]);

    summonTimerRef.current = window.setTimeout(scheduleSummon, 2_500);

    return () => {
      if (summonTimerRef.current) {
        window.clearTimeout(summonTimerRef.current);
      }
    };
  }, [scheduleSummon]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") {
        return;
      }

      if (event.key === "Escape") {
        if (isFirstUseGuideOpen) {
          event.preventDefault();
          setIsFirstUseGuideOpen(false);
          return;
        }

        if (activeStateKey) {
          event.preventDefault();
          setActiveStateKey(null);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeStateKey, isFirstUseGuideOpen]);

  useEffect(() => {
    if (!isFirstUseGuideOpen) {
      return;
    }

    firstUsePrimaryActionRef.current?.focus();
  }, [isFirstUseGuideOpen]);

  const centerVisualState = voiceOpen ? "voice_locked" : getCenterState(activeStateKey);
  const pageStyle = {
    "--dashboard-active-color": activeModuleColor ?? "#9FB7D8",
  } as CSSProperties;

  const handleOrbDragOffset = useCallback((x: number, y: number) => {
    setOrbDragOffset((current) => {
      if (current.x === x && current.y === y) {
        return current;
      }

      return { x, y };
    });
  }, []);

  const handleModuleNavigate = useCallback(
    (module: DashboardHomeModuleKey) => {
      const nextPath = getRouteForModule(module);
      navigate(nextPath);
    },
    [navigate],
  );
  const handleFirstUseGuideAcknowledge = useCallback(() => {
    markDashboardFirstUseGuideSeen();
    setHasSeenFirstUseGuide(true);
    setIsFirstUseGuideOpen(false);
  }, []);

  return (
    <ClickSpark className="dashboard-orbit-home" duration={360} extraScale={1.12} sparkColor="#d9b980" sparkCount={10} sparkRadius={18} sparkSize={11} style={pageStyle}>
      <header className="dashboard-orbit-home__hud">
        <div className="dashboard-orbit-home__badge-shell">
          <div className="dashboard-orbit-home__badge-dot" />
          <span>Dashboard Orbit</span>
        </div>

        <div className="dashboard-orbit-home__hud-actions">
          <button className="dashboard-orbit-home__guide-trigger" onClick={() => setIsFirstUseGuideOpen(true)} type="button">
            <BookOpenText className="h-4 w-4" />
            {guideTriggerLabel}
          </button>
          <div className="dashboard-orbit-home__shortcut-pill">
            <Keyboard className="h-3.5 w-3.5" />
            Ctrl / Cmd + 1 2 3 4 5
          </div>
        </div>
      </header>

      <div className="dashboard-orbit-home__canvas">
        <DashboardOrbitRings offset={orbDragOffset} />

        {dashboardDecorOrbs.map((config) => (
          <DashboardDecorOrb key={config.key} config={config} dimmed={isOverlayOpen} offset={orbDragOffset} />
        ))}

        {dashboardEntranceOrbs.map((config) => (
          <DashboardEntranceOrb
            key={config.key}
            config={config}
            dimmed={Boolean(activeState && activeState.module !== config.module) || voiceOpen || isFirstUseGuideOpen}
            isHovered={hoveredEntranceKey === config.key}
            offset={orbDragOffset}
            onClick={() => handleModuleNavigate(config.module)}
            onHoverChange={(hovered) => setHoveredEntranceKey(hovered ? config.key : null)}
          />
        ))}

        {!isOverlayOpen
          ? summons.map((event) => (
              <DashboardEventOrb
                key={event.id}
                event={event}
                stateMap={data.stateMap}
                onDismiss={(id) => {
                  setSummons((current) => current.filter((item) => item.id !== id));
                  if (event.recommendationId) {
                    onRecommendationFeedback?.(event.recommendationId, "negative");
                  }
                }}
                onExpand={(stateKey) => {
                  setActiveStateKey(stateKey);
                  if (event.recommendationId) {
                    onRecommendationFeedback?.(event.recommendationId, "positive");
                  }
                }}
              />
            ))
          : null}

        <DashboardCenterOrb activeColor={activeModuleColor} onDragOffset={handleOrbDragOffset} onLongPress={onVoiceOpen} visualState={centerVisualState} />
      </div>

      {isFirstUseGuideOpen ? (
        <div className="dashboard-orbit-home__guide-layer">
          <button aria-label="暂时关闭首次使用说明" className="dashboard-orbit-home__guide-backdrop" onClick={() => setIsFirstUseGuideOpen(false)} type="button" />
          <section aria-labelledby="dashboard-first-use-title" aria-modal="true" className="dashboard-orbit-home__guide-shell" role="dialog">
            <div className="dashboard-orbit-home__guide-header">
              <p className="dashboard-orbit-home__guide-eyebrow">第一次使用 · 桌面协作说明</p>
              <h2 className="dashboard-orbit-home__guide-title" id="dashboard-first-use-title">
                先把 CialloClaw 当成贴着任务现场的 Agent 入口。
              </h2>
              <p className="dashboard-orbit-home__guide-copy">
                你不需要先组织一整段 prompt。先说一句、选一段、拖一个文件，系统会先承接对象，再决定是否进入正式任务与交付链路。
              </p>
            </div>

            <div className="dashboard-orbit-home__guide-grid">
              <article className="dashboard-orbit-home__guide-card dashboard-orbit-home__guide-card--hero">
                <p className="dashboard-orbit-home__guide-section-label">怎么开始</p>
                <div className="dashboard-orbit-home__guide-list">
                  {dashboardFirstUseQuickStart.map((item) => (
                    <div className="dashboard-orbit-home__guide-item" key={item.title}>
                      <div className="dashboard-orbit-home__guide-item-icon">
                        <item.icon className="h-4 w-4" />
                      </div>
                      <div className="dashboard-orbit-home__guide-item-body">
                        <p className="dashboard-orbit-home__guide-item-title">{item.title}</p>
                        <p className="dashboard-orbit-home__guide-item-copy">{item.copy}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </article>

              <article className="dashboard-orbit-home__guide-card">
                <p className="dashboard-orbit-home__guide-section-label">高频场景</p>
                <div className="dashboard-orbit-home__guide-list">
                  {dashboardFirstUseScenarios.map((item) => (
                    <div className="dashboard-orbit-home__guide-item" key={item.title}>
                      <div className="dashboard-orbit-home__guide-item-icon">
                        <item.icon className="h-4 w-4" />
                      </div>
                      <div className="dashboard-orbit-home__guide-item-body">
                        <p className="dashboard-orbit-home__guide-item-title">{item.title}</p>
                        <p className="dashboard-orbit-home__guide-item-copy">{item.copy}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </article>

              <article className="dashboard-orbit-home__guide-card">
                <p className="dashboard-orbit-home__guide-section-label">四个工作台舱位</p>
                <div className="dashboard-orbit-home__guide-list">
                  {dashboardFirstUseWorkbench.map((item) => (
                    <div className="dashboard-orbit-home__guide-item" key={item.title}>
                      <div className="dashboard-orbit-home__guide-item-icon">
                        <item.icon className="h-4 w-4" />
                      </div>
                      <div className="dashboard-orbit-home__guide-item-body">
                        <p className="dashboard-orbit-home__guide-item-title">{item.title}</p>
                        <p className="dashboard-orbit-home__guide-item-copy">{item.copy}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            </div>

            <div className="dashboard-orbit-home__guide-actions">
              <p className="dashboard-orbit-home__guide-actions-copy">关闭后仍可从右上角重新打开这份说明。</p>
              <div className="dashboard-orbit-home__guide-action-row">
                <button className="dashboard-orbit-home__guide-button dashboard-orbit-home__guide-button--ghost" onClick={() => setIsFirstUseGuideOpen(false)} type="button">
                  稍后再看
                </button>
                <button
                  className="dashboard-orbit-home__guide-button dashboard-orbit-home__guide-button--primary"
                  onClick={handleFirstUseGuideAcknowledge}
                  ref={firstUsePrimaryActionRef}
                  type="button"
                >
                  开始使用
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}

      <div className={cn("dashboard-orbit-home__focus-bar", isOverlayOpen && "is-muted")}>
        <div className="dashboard-orbit-home__focus-main">
          <p className="dashboard-orbit-home__focus-eyebrow">现在最值得注意的</p>
          <p className="dashboard-orbit-home__focus-title">{currentFocusLine}</p>
          <p className="dashboard-orbit-home__focus-copy">{currentReasonLine}</p>
        </div>
        <div className="dashboard-orbit-home__focus-hint">
          <Sparkles className="h-4 w-4" />
          入口球负责跳页，事件球负责展开首页实时信号。
        </div>
      </div>

      <DashboardEventPanel activeState={activeState} onClose={() => setActiveStateKey(null)} onStateChange={setActiveStateKey} stateGroups={data.stateGroups} stateMap={data.stateMap} />
    </ClickSpark>
  );
}
