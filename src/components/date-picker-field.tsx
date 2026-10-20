import { useState } from "react";
import { ptBR } from "date-fns/locale";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { addDays, fromDateKey, toDateKey } from "@/lib/format";

/**
 * Seletor de data: atalhos (Hoje, Amanhã, Em 1 semana) e um calendário em português.
 * O valor continua sendo o texto "AAAA-MM-DD", igual ao campo de data anterior.
 */
export function DatePickerField({
  id,
  value,
  onChange,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const selected = value ? fromDateKey(value) : undefined;

  const shortcuts = [
    { label: "Hoje", date: today },
    { label: "Amanhã", date: addDays(today, 1) },
    { label: "Em 1 semana", date: addDays(today, 7) },
  ];

  const label = selected
    ? selected.toLocaleDateString("pt-BR", {
        weekday: "short",
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : "Escolher data";

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {shortcuts.map((s) => {
          const key = toDateKey(s.date);
          return (
            <Button
              key={s.label}
              type="button"
              size="sm"
              variant={value === key ? "default" : "outline"}
              className="h-9 px-3"
              onClick={() => onChange(key)}
            >
              {s.label}
            </Button>
          );
        })}
      </div>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            className="h-11 w-full justify-start gap-2 font-normal"
          >
            <CalendarDays className="size-4 text-muted-foreground" aria-hidden />
            <span className="capitalize">{label}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            locale={ptBR}
            selected={selected}
            defaultMonth={selected ?? today}
            disabled={{ before: today }}
            onSelect={(date) => {
              if (!date) return;
              onChange(toDateKey(date));
              setOpen(false);
            }}
            className="[--cell-size:2.5rem]"
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
