import { EditableOptionPicker, type EditableOption } from "../EditableOptionPicker";
import React, { useEffect, useState } from "react";
import { cn } from "@/features/platform-admin-dashboard/upstream/lib/utils";
import { format } from "date-fns";
import { Calendar } from "../../ui/calendar";
import { Button } from "../../ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../../ui/command";
import {
  CalendarBlank,
  ChartBar,
  Check,
  Microphone,
  List,
  Paperclip,
  Rows,
  Spinner,
  Tag,
  UserCircle,
  X,
} from "@phosphor-icons/react/dist/ssr";
import { ProjectDescriptionEditor } from "../ProjectDescriptionEditor";
import { type Client } from "@/features/platform-admin-dashboard/upstream/lib/data/clients";

export type StepQuickCreateUserOption = {
  id: string;
  name: string;
  avatar?: string;
};

export type StepQuickCreateStatusOption = {
  id: string;
  label: string;
  dotClass?: string;
};

export type StepQuickCreatePriorityOption = {
  id: "no-priority" | "low" | "medium" | "high" | "urgent";
  label: string;
};

export type StepQuickCreateOption = {
  id: string;
  label: string;
};

export type StepQuickCreateTagOption = {
  id: string;
  label: string;
  color?: string;
};

export type StepQuickCreateValue = {
  assigneeId?: string;
  clientId?: string;
  description?: string;
  priorityId?: string;
  sprintTypeId?: string;
  sprintTypeLabel?: string;
  tagLabel?: string;
  optionSettings?: { tags: EditableOption[]; sprintTypes: EditableOption[] };
  startDate?: Date;
  statusId?: string;
  tagId?: string;
  targetDate?: Date;
  title: string;
  workstreamId?: string;
};

const EMPTY_ORGANIZATIONS: Client[] = [];

const USERS: StepQuickCreateUserOption[] = [
  { id: "1", name: "Jason D", avatar: "/platform-lab/avatar-profile.jpg" },
  { id: "2", name: "Sarah Connor", avatar: "" },
  { id: "3", name: "Alex Murphy", avatar: "" },
];

const STATUSES: StepQuickCreateStatusOption[] = [
  { id: "backlog", label: "Backlog", dotClass: "bg-orange-600" },
  { id: "todo", label: "Todo", dotClass: "bg-neutral-300" },
  { id: "in-progress", label: "In Progress", dotClass: "bg-yellow-400" },
  { id: "done", label: "Done", dotClass: "bg-green-600" },
  { id: "canceled", label: "Canceled", dotClass: "bg-neutral-400" },
];

const PRIORITIES: StepQuickCreatePriorityOption[] = [
  { id: "no-priority", label: "No Priority" },
  { id: "urgent", label: "Urgent" },
  { id: "high", label: "High" },
  { id: "medium", label: "Medium" },
  { id: "low", label: "Low" },
];

const SPRINT_TYPES: StepQuickCreateOption[] = [
  { id: "design", label: "Design Sprint" },
  { id: "dev", label: "Dev Sprint" },
  { id: "planning", label: "Planning" },
];

const WORKSTREAMS: StepQuickCreateOption[] = [
  { id: "frontend", label: "Frontend" },
  { id: "backend", label: "Backend" },
  { id: "design", label: "Design" },
  { id: "qa", label: "QA" },
];

const TAGS: StepQuickCreateTagOption[] = [
  { id: "bug", label: "Bug", color: "var(--chart-5)" },
  { id: "feature", label: "Feature", color: "var(--chart-2)" },
  { id: "enhancement", label: "Enhancement", color: "var(--chart-4)" },
  { id: "docs", label: "Documentation", color: "var(--chart-3)" },
];

function Wrapper({
  children,
  className,
}: React.PropsWithChildren<{ className?: string }>) {
  return (
    <div className={cn("relative shrink-0 size-[16px]", className)}>
      <svg
        className="block size-full"
        fill="none"
        preserveAspectRatio="none"
        viewBox="0 0 16 16"
      >
        {children}
      </svg>
    </div>
  );
}

interface PickerProps<T> {
  trigger: React.ReactNode;
  items: T[];
  onSelect: (item: T) => void;
  selectedId?: string;
  onCreate?: (label: string) => void;
  createLabel?: string;
  placeholder?: string;
  renderItem: (item: T, isSelected: boolean) => React.ReactNode;
}

export function GenericPicker<
  T extends { id: string; label?: string; name?: string },
>({
  trigger,
  items,
  onSelect,
  selectedId,
  placeholder = "Search...",
  renderItem,
  onCreate,
  createLabel = "tag",
}: PickerProps<T>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const label = query.trim();
  const canCreate = Boolean(onCreate && label && !items.some((item) =>
    (item.label || item.name || item.id).toLowerCase() === label.toLowerCase()));

  return (
    <Popover open={open} onOpenChange={(nextOpen) => { setOpen(nextOpen); setQuery(""); }}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="p-0 w-[240px]" align="start">
        <Command>
          <CommandInput placeholder={placeholder} value={query} onValueChange={setQuery} />
          <CommandList>
            {!canCreate && <CommandEmpty>No results found.</CommandEmpty>}
            <CommandGroup>
              {items.map((item) => (
                <CommandItem
                  key={item.id}
                  value={item.label || item.name || item.id}
                  onSelect={() => {
                    onSelect(item);
                    setOpen(false);
                  }}
                  className="cursor-pointer"
                >
                  {renderItem(item, item.id === selectedId)}
                </CommandItem>
              ))}
              {canCreate && (
                <CommandItem
                  value={`Create ${label}`}
                  forceMount
                  onSelect={() => { onCreate?.(label); setOpen(false); setQuery(""); }}
                >
                  Create {createLabel} “{label}”
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

interface DatePickerProps {
  date?: Date;
  onSelect: (date: Date | undefined) => void;
  trigger: React.ReactNode;
}

export function DatePicker({
  date,
  onSelect,
  trigger,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(nextDate) => {
            onSelect(nextDate);
            setOpen(false);
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}

interface StepQuickCreateProps {
  onClose: () => void;
  onCreate: (value: StepQuickCreateValue) => void;
  onExpandChange?: (isExpanded: boolean) => void;
  mode?: "create" | "edit";
  submitLabel?: string;
  submitPending?: boolean;
  error?: string;
  manageOption?: (kind: "tag" | "sprintType", action: "save" | "delete", option: EditableOption) => Promise<{ error?: string; option?: EditableOption }>;
  initialValue?: Partial<StepQuickCreateValue>;
  users?: StepQuickCreateUserOption[];
  statuses?: StepQuickCreateStatusOption[];
  priorities?: StepQuickCreatePriorityOption[];
  sprintTypes?: StepQuickCreateOption[];
  workstreams?: StepQuickCreateOption[];
  tags?: StepQuickCreateTagOption[];
  clients?: Client[];
}

function resolveSelected<T extends { id: string }>(
  items: T[],
  selectedId: string | undefined,
  fallbackIndex?: number,
): T | null {
  if (selectedId) {
    const selected = items.find((item) => item.id === selectedId);
    if (selected) return selected;
  }

  const fallback =
    typeof fallbackIndex === "number" ? items[fallbackIndex] : items[0];
  return fallback ?? null;
}

export function StepQuickCreate({
  onClose,
  onCreate,
  onExpandChange,
  mode = "create",
  submitLabel,
  submitPending = false,
  error,
  manageOption,
  initialValue,
  users = USERS,
  statuses = STATUSES,
  priorities = PRIORITIES,
  sprintTypes = SPRINT_TYPES,
  workstreams = WORKSTREAMS,
  tags = TAGS,
  clients: clientOptions = EMPTY_ORGANIZATIONS,
}: StepQuickCreateProps) {
  const [title, setTitle] = useState(initialValue?.title ?? "");
  const [description, setDescription] = useState<string | undefined>(
    initialValue?.description,
  );
  const [assignee, setAssignee] = useState<StepQuickCreateUserOption | null>(
    () => resolveSelected(users, initialValue?.assigneeId),
  );
  const [startDate, setStartDate] = useState<Date | undefined>(
    initialValue?.startDate ?? new Date(),
  );
  const [status, setStatus] = useState<StepQuickCreateStatusOption | null>(
    () => resolveSelected(statuses, initialValue?.statusId, 1),
  );
  const [sprintOptions, setSprintOptions] = useState<EditableOption[]>(initialValue?.optionSettings?.sprintTypes ?? sprintTypes);
  const [tagOptions, setTagOptions] = useState<EditableOption[]>(initialValue?.optionSettings?.tags ?? tags);
  const [optionsChanged, setOptionsChanged] = useState(false);
  const [sprintType, setSprintType] = useState<StepQuickCreateOption | null>(
    () => resolveSelected(initialValue?.optionSettings?.sprintTypes ?? sprintTypes, initialValue?.sprintTypeId, undefined) ?? (initialValue?.optionSettings?.sprintTypes ?? sprintTypes).find((option) => option.label === initialValue?.sprintTypeId) ?? (initialValue?.sprintTypeId ? { id: initialValue.sprintTypeId, label: initialValue.sprintTypeId } : null),
  );
  const [targetDate, setTargetDate] = useState<Date | undefined>(
    initialValue?.targetDate,
  );
  const [workstream, setWorkstream] = useState<StepQuickCreateOption | null>(
    () => resolveSelected(workstreams, initialValue?.workstreamId, undefined),
  );
  const [priority, setPriority] = useState<StepQuickCreatePriorityOption | null>(
    () => resolveSelected(priorities, initialValue?.priorityId, undefined),
  );
  const [selectedTag, setSelectedTag] = useState<StepQuickCreateTagOption | null>(
    () => resolveSelected(initialValue?.optionSettings?.tags ?? tags, initialValue?.tagId, undefined) ?? (initialValue?.optionSettings?.tags ?? tags).find((option) => option.label === initialValue?.tagId) ?? (initialValue?.tagId ? { id: initialValue.tagId, label: initialValue.tagId } : null),
  );
  const [client, setClient] = useState<Client | null>(
    () => resolveSelected(clientOptions, initialValue?.clientId, undefined),
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      const titleInput = document.getElementById("quick-create-title");
      if (titleInput) titleInput.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    setSprintOptions(initialValue?.optionSettings?.sprintTypes ?? sprintTypes);
    setTagOptions(initialValue?.optionSettings?.tags ?? tags);
    setOptionsChanged(false);
    setTitle(initialValue?.title ?? "");
    setDescription(initialValue?.description);
    setAssignee(resolveSelected(users, initialValue?.assigneeId));
    setStartDate(initialValue?.startDate ?? new Date());
    setStatus(resolveSelected(statuses, initialValue?.statusId, 1));
    setSprintType(resolveSelected(initialValue?.optionSettings?.sprintTypes ?? sprintTypes, initialValue?.sprintTypeId, undefined) ?? (initialValue?.optionSettings?.sprintTypes ?? sprintTypes).find((option) => option.label === initialValue?.sprintTypeId) ?? (initialValue?.sprintTypeId ? { id: initialValue.sprintTypeId, label: initialValue.sprintTypeId } : null));
    setTargetDate(initialValue?.targetDate);
    setWorkstream(resolveSelected(workstreams, initialValue?.workstreamId, undefined));
    setPriority(resolveSelected(priorities, initialValue?.priorityId, undefined));
    setSelectedTag(resolveSelected(initialValue?.optionSettings?.tags ?? tags, initialValue?.tagId, undefined) ?? (initialValue?.optionSettings?.tags ?? tags).find((option) => option.label === initialValue?.tagId) ?? (initialValue?.tagId ? { id: initialValue.tagId, label: initialValue.tagId } : null));
    setClient(resolveSelected(clientOptions, initialValue?.clientId, undefined));
  }, [
    clientOptions,
    initialValue,
    priorities,
    sprintTypes,
    statuses,
    tags,
    users,
    workstreams,
  ]);

  const handleSubmit = () => {
    if (submitPending || error) return;
    onCreate({
      title,
      description,
      assigneeId: assignee?.id,
      startDate,
      statusId: status?.id,
      sprintTypeId: sprintType?.id,
      sprintTypeLabel: sprintType?.label,
      tagLabel: selectedTag?.label,
      ...(!manageOption && (optionsChanged || initialValue?.optionSettings) ? { optionSettings: { tags: tagOptions, sprintTypes: sprintOptions } } : {}),
      targetDate,
      workstreamId: workstream?.id,
      priorityId: priority?.id,
      tagId: selectedTag?.id,
      clientId: client?.id,
    });
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      handleSubmit();
    }
  };

  return (
    <div
      className="bg-background relative rounded-3xl size-full font-sans overflow-hidden flex flex-col"
      onKeyDown={handleKeyDown}
    >
      {error && <p role="alert" className="px-4 text-sm text-destructive">{error}</p>}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onClose}
        className="absolute right-4 top-3 opacity-70 hover:opacity-100 rounded-xl"
      >
        <X className="size-4 text-muted-foreground" />
      </Button>

      <div className="flex flex-col flex-1 p-3.5 px-4 gap-3.5 overflow-hidden">
        <div className="flex flex-col gap-2 w-full shrink-0 mt-2">
          <div className="flex gap-1 h-10 items-center w-full">
            <input
              id="quick-create-title"
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Project title"
              className="w-full font-normal leading-7 text-foreground placeholder:text-muted-foreground text-xl outline-none bg-transparent border-none p-0"
              autoComplete="off"
            />
          </div>
        </div>

        <ProjectDescriptionEditor
          value={description}
          onChange={setDescription}
          onExpandChange={onExpandChange}
        />

        <div className="flex flex-wrap gap-2.5 items-start w-full shrink-0">
          <GenericPicker
            items={users}
            onSelect={setAssignee}
            selectedId={assignee?.id}
            placeholder="Assign owner..."
            renderItem={(item, isSelected) => (
              <div className="flex items-center gap-2 w-full">
                {item.avatar ? (
                  <img
                    src={item.avatar}
                    alt=""
                    className="size-5 rounded-full object-cover"
                  />
                ) : (
                  <div className="size-5 rounded-full bg-muted flex items-center justify-center text-xs font-bold">
                    {item.name.charAt(0)}
                  </div>
                )}
                <span className="flex-1">{item.name}</span>
                {isSelected && <Check className="size-4" />}
              </div>
            )}
            trigger={
              <button className="bg-muted flex gap-2 h-9 items-center px-3 py-2 rounded-lg border border-border hover:border-primary/50 transition-colors">
                <div className="relative rounded-full size-4 overflow-hidden">
                  {assignee?.avatar ? (
                    <img
                      alt=""
                      className="object-cover size-full"
                      src={assignee.avatar}
                    />
                  ) : (
                    <div className="bg-muted size-full flex items-center justify-center text-xs">
                      {assignee?.name?.charAt(0) ?? "?"}
                    </div>
                  )}
                </div>
                <span className="font-medium text-foreground text-sm leading-5">
                  {assignee?.name ?? "Owner"}
                </span>
              </button>
            }
          />

          <DatePicker
            date={startDate}
            onSelect={setStartDate}
            trigger={
              <button className="bg-muted flex gap-2 h-9 items-center px-3 py-2 rounded-lg border border-border hover:border-primary/50 transition-colors">
                <CalendarBlank className="size-4 text-muted-foreground" />
                <span className="font-medium text-foreground text-sm leading-5">
                  {startDate
                    ? `Start: ${format(startDate, "dd/MM/yyyy")}`
                    : "Start Date"}
                </span>
              </button>
            }
          />

          <GenericPicker
            items={clientOptions}
            onSelect={setClient}
            selectedId={client?.id}
            placeholder="Find organization..."
            renderItem={(item, isSelected) => (
              <div className="flex items-center gap-2 w-full">
                <div className="size-5 rounded-full bg-muted flex items-center justify-center text-xs font-bold">
                  {item.name.charAt(0)}
                </div>
                <span className="flex-1">{item.name}</span>
                {isSelected && <Check className="size-4" />}
              </div>
            )}
            trigger={
              <button
                className={cn(
                  "flex gap-2 h-9 items-center px-3 py-2 rounded-lg border border-border transition-colors",
                  client ? "bg-muted" : "bg-background hover:bg-black/5",
                )}
              >
                <UserCircle className="size-4 text-muted-foreground" />
                <span className="font-medium text-foreground text-sm leading-5">
                  {client ? client.name : "Organization"}
                </span>
              </button>
            }
          />

          <GenericPicker
            items={statuses}
            onSelect={setStatus}
            selectedId={status?.id}
            placeholder="Change status..."
            renderItem={(item, isSelected) => (
              <div className="flex items-center gap-2 w-full">
                <div className={cn("size-3 rounded-full", item.dotClass)} />
                <span className="flex-1">{item.label}</span>
                {isSelected && <Check className="size-4" />}
              </div>
            )}
            trigger={
              <button
                className={cn(
                  "flex gap-2 h-9 items-center px-3 py-2 rounded-lg border border-border transition-colors",
                  "bg-background hover:bg-black/5",
                )}
              >
                <Wrapper>
                  <g clipPath="url(#clip0_13_2475)" id="Icon / Loader">
                    <Spinner className="size-4 text-muted-foreground" />
                  </g>
                  <defs>
                    <clipPath id="clip0_13_2475">
                      <rect fill="white" height="16" width="16" />
                    </clipPath>
                  </defs>
                </Wrapper>
                {status?.id !== "backlog" && status?.dotClass ? (
                  <div className={cn("size-2 rounded-full", status.dotClass)} />
                ) : null}
                <span className="font-medium text-foreground text-sm leading-5">
                  {status?.label ?? "Status"}
                </span>
              </button>
            }
          />

          <EditableOptionPicker
            shared={Boolean(manageOption)}
            noun="sprint type"
            options={[...sprintOptions, ...(sprintType && !sprintOptions.some((option) => option.id === sprintType.id) ? [sprintType] : [])]}
            selectedId={sprintType?.id}
            onSelect={setSprintType}
            onSave={async (option) => {
              if (manageOption) {
                const result = await manageOption("sprintType", "save", option);
                if (result.error) return result.error;
                if (!result.option) return "Could not save option.";
                option = result.option;
              }
              setSprintOptions((current) => [...current.filter((item) => item.id !== option.id), option]);
              setSprintType(option);
              setOptionsChanged(true);
            }}
            onDelete={async (option) => {
              if (manageOption) {
                const result = await manageOption("sprintType", "delete", option);
                if (result.error) return result.error;
              }
              setSprintOptions((current) => current.filter((item) => item.id !== option.id));
              if (sprintType?.id === option.id) setSprintType(null);
              setOptionsChanged(true);
            }}
            trigger={
              <button className="bg-background flex gap-2 h-9 items-center px-3 py-2 rounded-lg border border-border hover:bg-black/5 transition-colors">
                <List className="size-4 text-muted-foreground" />
                <span className="font-medium text-foreground text-sm leading-5">
                  {sprintType && <span className="mr-1 inline-block size-2 rounded-full" style={{ backgroundColor: (sprintType as EditableOption).color ?? "#64748b" }} />}{sprintType ? sprintType.label : "Sprint Type"}
                </span>
              </button>
            }
          />

          <DatePicker
            date={targetDate}
            onSelect={setTargetDate}
            trigger={
              <button className="bg-background flex gap-2 h-9 items-center px-3 py-2 rounded-lg border border-border hover:bg-black/5 transition-colors">
                <CalendarBlank className="size-4 text-muted-foreground" />
                <span className="font-medium text-foreground text-sm leading-5">
                  {targetDate ? format(targetDate, "dd/MM/yyyy") : "Target"}
                </span>
              </button>
            }
          />

          <GenericPicker
            items={workstreams}
            onSelect={setWorkstream}
            selectedId={workstream?.id}
            placeholder="Select workstream..."
            renderItem={(item, isSelected) => (
              <div className="flex items-center gap-2 w-full">
                <span className="flex-1">{item.label}</span>
                {isSelected && <Check className="size-4" />}
              </div>
            )}
            trigger={
              <button className="bg-background flex gap-2 h-9 items-center px-3 py-2 rounded-lg border border-border hover:bg-black/5 transition-colors">
                <Rows className="size-4 text-muted-foreground" />
                <span className="font-medium text-foreground text-sm leading-5">
                  {workstream ? workstream.label : "Workstreams"}
                </span>
              </button>
            }
          />

          <GenericPicker
            items={priorities}
            onSelect={setPriority}
            selectedId={priority?.id}
            placeholder="Set priority..."
            renderItem={(item, isSelected) => (
              <div className="flex items-center gap-2 w-full">
                <span className="flex-1">{item.label}</span>
                {isSelected && <Check className="size-4" />}
              </div>
            )}
            trigger={
              <button className="bg-background flex gap-2 h-9 items-center px-3 py-2 rounded-lg border border-border hover:bg-black/5 transition-colors">
                <ChartBar className="size-4 text-muted-foreground" />
                <span className="font-medium text-foreground text-sm leading-5">
                  {priority ? priority.label : "Priority"}
                </span>
              </button>
            }
          />

          <EditableOptionPicker
            shared={Boolean(manageOption)}
            noun="tag"
            options={[...tagOptions, ...(selectedTag && !tagOptions.some((option) => option.id === selectedTag.id) ? [selectedTag] : [])]}
            selectedId={selectedTag?.id}
            onSelect={setSelectedTag}
            onSave={async (option) => {
              if (manageOption) {
                const result = await manageOption("tag", "save", option);
                if (result.error) return result.error;
                if (!result.option) return "Could not save option.";
                option = result.option;
              }
              setTagOptions((current) => [...current.filter((item) => item.id !== option.id), option]);
              setSelectedTag(option);
              setOptionsChanged(true);
            }}
            onDelete={async (option) => {
              if (manageOption) {
                const result = await manageOption("tag", "delete", option);
                if (result.error) return result.error;
              }
              setTagOptions((current) => current.filter((item) => item.id !== option.id));
              if (selectedTag?.id === option.id) setSelectedTag(null);
              setOptionsChanged(true);
            }}
            trigger={
              <button className="bg-background flex gap-2 h-9 items-center px-3 py-2 rounded-lg border border-border hover:bg-black/5 transition-colors">
                <Wrapper>
                  <g clipPath="url(#clip0_13_2458)" id="Icon / Tag">
                    <Tag className="size-4 text-muted-foreground" />
                  </g>
                  <defs>
                    <clipPath id="clip0_13_2458">
                      <rect fill="white" height="16" width="16" />
                    </clipPath>
                  </defs>
                </Wrapper>
                <span className="font-medium text-foreground text-sm leading-5">
                  {selectedTag && <span className="mr-1 inline-block size-2 rounded-full" style={{ backgroundColor: selectedTag.color ?? "#64748b" }} />}{selectedTag ? selectedTag.label : "Tag"}
                </span>
              </button>
            }
          />
        </div>

        <div className="flex items-center justify-between mt-auto w-full pt-4 shrink-0">
          <div className="flex items-center">
            <button className="flex items-center justify-center size-10 rounded-lg hover:bg-black/5 transition-colors cursor-pointer">
              <Paperclip className="size-4 text-muted-foreground" />
            </button>
            <button className="flex items-center justify-center size-10 rounded-lg hover:bg-black/5 transition-colors cursor-pointer">
              <Microphone className="size-4 text-muted-foreground" />
            </button>
          </div>

          <button
            onClick={handleSubmit}
            disabled={submitPending || Boolean(error)}
            className="bg-primary hover:bg-primary/90 disabled:opacity-60 flex gap-3 h-10 items-center justify-center px-4 py-2 rounded-lg transition-colors cursor-pointer"
          >
            <span className="font-medium text-primary-foreground text-sm leading-5">
              {submitPending
                ? mode === "edit"
                  ? "Saving..."
                  : "Creating..."
                : submitLabel ?? (mode === "edit" ? "Save Changes" : "Create Project")}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
