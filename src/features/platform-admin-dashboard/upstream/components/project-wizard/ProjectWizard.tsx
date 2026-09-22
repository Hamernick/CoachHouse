"use client";

import { useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Stepper } from "./Stepper";
import { ProjectData, ProjectMode } from "./types";
import { StepMode } from "./steps/StepMode";
import { StepIntent } from "./steps/StepIntent";
import { StepOutcome } from "./steps/StepOutcome";
import type { EditableOption } from "./EditableOptionPicker";
import { StepOwnership } from "./steps/StepOwnership";
import { StepStructure } from "./steps/StepStructure";
import { StepReview } from "./steps/StepReview";
import {
  StepQuickCreate,
  type StepQuickCreateOption,
  type StepQuickCreatePriorityOption,
  type StepQuickCreateStatusOption,
  type StepQuickCreateTagOption,
  type StepQuickCreateUserOption,
  type StepQuickCreateValue,
} from "./steps/StepQuickCreate";
import { CaretLeft, CaretRight, X } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/features/platform-admin-dashboard/upstream/lib/utils";
import type { Client } from "@/features/platform-admin-dashboard/upstream/lib/data/clients";

const QUICK_CREATE_STEP = 100;

interface ProjectWizardProps {
  renderGuidedSetup?: () => ReactNode;
  onClose: () => void;
  onCreate?: () => void | Promise<void>;
  mode?: "create" | "edit";
  skipModeStep?: boolean;
  quickCreateInitialValue?: Partial<StepQuickCreateValue>;
  quickCreateSubmitLabel?: string;
  quickCreateSubmitPending?: boolean;
  quickCreateError?: string;
  manageOption?: (kind: "tag" | "sprintType", action: "save" | "delete", option: EditableOption) => Promise<{ error?: string; option?: EditableOption }>;
  quickCreateUsers?: StepQuickCreateUserOption[];
  quickCreateStatuses?: StepQuickCreateStatusOption[];
  quickCreatePriorities?: StepQuickCreatePriorityOption[];
  quickCreateSprintTypes?: StepQuickCreateOption[];
  quickCreateWorkstreams?: StepQuickCreateOption[];
  quickCreateTags?: StepQuickCreateTagOption[];
  quickCreateClients?: Client[];
  onQuickCreate?: (value: StepQuickCreateValue) => void | Promise<void>;
  onGuidedCreate?: (data: ProjectData) => void | Promise<void>;
  guidedCreateLabel?: string;
  guidedCreatePending?: boolean;
}

export function ProjectWizard({
  renderGuidedSetup,
  onClose,
  onCreate,
  mode = "create",
  skipModeStep = false,
  quickCreateInitialValue,
  quickCreateSubmitLabel,
  quickCreateSubmitPending = false,
  quickCreateError,
  manageOption,
  quickCreateUsers,
  quickCreateStatuses,
  quickCreatePriorities,
  quickCreateSprintTypes,
  quickCreateWorkstreams,
  quickCreateTags,
  quickCreateClients,
  onQuickCreate,
  onGuidedCreate,
  guidedCreateLabel,
  guidedCreatePending = false,
}: ProjectWizardProps) {
  const initialStep = skipModeStep ? QUICK_CREATE_STEP : 0;
  const [step, setStep] = useState(initialStep);
  const [maxStepReached, setMaxStepReached] = useState(0);
  const [isQuickCreateExpanded, setIsQuickCreateExpanded] = useState(false);
  const [data, setData] = useState<ProjectData>({
    mode: skipModeStep ? "quick" : undefined,
    successType: 'undefined',
    deliverables: [],
    metrics: [],
    description: '',
    deadlineType: 'none',
    contributorIds: [],
    stakeholderIds: [],
    addStarterTasks: false,
  });

  // Step 0 is Mode Selection. It's separate from the numbered stepper.
  // The numbered stepper starts at Step 1 (Intent).
  // Internally:
  // 0: Mode
  // 1: Intent
  // 2: Outcome
  // 3: Ownership
  // 4: Structure
  // 5: Review

  const updateData = (updates: Partial<ProjectData>) => {
    setData(prev => ({ ...prev, ...updates }));
  };

  const nextStep = () => {
    if (step === 0 && data.mode === 'quick') {
      setStep(QUICK_CREATE_STEP); // Magic number for Quick Create View
      return;
    }
    
    setStep(prev => {
        const next = prev + 1;
        setMaxStepReached(m => Math.max(m, next));
        return next;
    });
  };

  const prevStep = () => {
    setStep(prev => prev - 1);
  };

  const jumpToStep = (s: number) => {
      // Adjust because stepper index 0 maps to internal step 1
      setStep(s + 1);
  }

  const handleEditStepFromReview = (targetStep: number) => {
    // targetStep uses the internal step index (1-4)
    setStep(targetStep);
  };

  const isNextDisabled = () => {
      if (step === 3 && !quickCreateUsers?.some((person) => person.id === data.ownerId)) return true; // Step 3: Ownership
      return false;
  }

  const handleClose = () => {
    onClose();
  };

  const handleQuickCreate = async (value: StepQuickCreateValue) => {
    if (onQuickCreate) {
      await onQuickCreate(value);
      return;
    }

    await onCreate?.();
    toast.success(mode === "edit" ? "Project updated successfully" : "Project created successfully");
    onClose();
  };

  const handleGuidedCreate = async () => {
    if (onGuidedCreate) {
      await onGuidedCreate(data);
      return;
    }

    await onCreate?.();
    toast.success("Project created successfully");
    onClose();
  };

  // Define steps for the stepper (excluding Mode selection)
  const steps = [
    "Project intent",
    "Outcome & success",
    "Ownership",
    "Work structure",
    "Review & create"
  ];

  const stepTitles: Record<number, string> = {
    1: "What is this project mainly about?",
    2: "How do you define success?",
    3: "Who is responsible for this project?",
    4: "How should this project be structured?",
    5: "Review project setup",
  };

  if (data.mode === "guided" && step > 0 && renderGuidedSetup) return renderGuidedSetup();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ 
            opacity: 1, 
            scale: 1,
            height: step === QUICK_CREATE_STEP 
                ? (isQuickCreateExpanded ? "85vh" : "auto") 
                : "auto"
        }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className={cn(
            "flex w-full max-w-[900px] overflow-hidden rounded-[24px] bg-background shadow-2xl"
        )}
      >
        {step === 0 ? (
             <StepMode 
                selected={data.mode} 
                onSelect={(m) => updateData({ mode: m })} 
                onContinue={nextStep}
                onCancel={handleClose}
                onClose={handleClose}
             />
        ) : step === QUICK_CREATE_STEP ? (
            <StepQuickCreate 
                onClose={handleClose} 
                mode={mode}
                onCreate={(value) => {
                  void handleQuickCreate(value);
                }}
                onExpandChange={setIsQuickCreateExpanded}
                initialValue={quickCreateInitialValue}
                submitLabel={quickCreateSubmitLabel}
                submitPending={quickCreateSubmitPending}
                      error={quickCreateError}
                      manageOption={manageOption}
                users={quickCreateUsers}
                statuses={quickCreateStatuses}
                priorities={quickCreatePriorities}
                sprintTypes={quickCreateSprintTypes}
                workstreams={quickCreateWorkstreams}
                tags={quickCreateTags}
                clients={quickCreateClients}
            />
        ) : (
            <>
                {/* Left Sidebar (Stepper) */}
                <div className="hidden w-64 border-r border-border bg-background px-6 py-7 md:flex md:flex-col md:gap-7">
                  <div>
                    <p className="text-sm font-semibold text-foreground">New Project</p>
                  </div>
                  <Stepper 
                    currentStep={step - 1} 
                    steps={steps} 
                    onStepClick={jumpToStep}
                    maxStepReached={maxStepReached - 1}
                  />
                </div>

                {/* Main Content */}
                <div className="flex flex-1 flex-col">
                    {/* Header: Title + Close button */}
                    <div className="flex items-start justify-between px-8 pt-6 pb-4">
                        <div className="pr-6">
                          {stepTitles[step] && (
                            <h2 className="text-lg font-semibold tracking-tight">
                              {stepTitles[step]}
                            </h2>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-full"
                          onClick={handleClose}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                    </div>

                    {/* Scrollable Content Area */}
                    <div className="flex-1 overflow-y-auto px-8 pb-8 pt-0">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={step}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.2 }}
                                className="h-full"
                            >
                                {step === 1 && (
                                    <StepIntent selected={data.intent} onSelect={(i) => updateData({ intent: i })} />
                                )}
                                {step === 2 && (
                                    <StepOutcome data={data} updateData={updateData} />
                                )}
                                {step === 3 && (
                                    <StepOwnership data={data} updateData={updateData} people={quickCreateUsers} organizations={quickCreateClients} />
                                )}
                                {step === 4 && (
                                    <StepStructure data={data} updateData={updateData} />
                                )}
                                {step === 5 && (
                                    <StepReview data={data} people={quickCreateUsers} onEditStep={handleEditStepFromReview} />
                                )}
                            </motion.div>
                        </AnimatePresence>
                    </div>

                    {/* Footer Actions */}
                    <div className="flex items-center justify-between bg-background p-6">
                        <div>
                            <Button variant="outline" onClick={prevStep}>
                                <CaretLeft className=" h-4 w-4" />
                                Back
                            </Button>
                        </div>

                        <div className="flex gap-3">
                            {step === 5 ? (
                                <>
                                    <Button variant="outline">Save as template</Button>
                                    <Button
                                      disabled={guidedCreatePending}
                                      onClick={() => {
                                        void handleGuidedCreate();
                                      }}
                                    >
                                      {guidedCreatePending
                                        ? "Creating..."
                                        : guidedCreateLabel ?? "Create project"}
                                    </Button>
                                </>
                            ) : (
                                <Button 
                                    onClick={nextStep} 
                                    disabled={isNextDisabled()}
                                >
                                    Next
                                    <CaretRight className=" h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </>
        )}
      </motion.div>
    </div>
  );
}
