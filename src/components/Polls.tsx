import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Plus, Minus, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export type Poll = {
  id: string;
  conversation_id: string;
  creator_id: string;
  question: string;
  expires_at: string | null;
  created_at: string;
};

export type PollOption = {
  id: string;
  poll_id: string;
  option_text: string;
};

export type PollVote = {
  poll_id: string;
  option_id: string;
  user_id: string;
  created_at: string;
};

export function PollCreateModal({
  isOpen,
  onClose,
  conversationId,
  userId,
  onCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  conversationId: string;
  userId: string;
  onCreated: (pollId: string) => void;
}) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const qc = useQueryClient();

  if (!isOpen) return null;

  function addOption() {
    if (options.length < 10) {
      setOptions([...options, ""]);
    }
  }

  function removeOption(index: number) {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  }

  async function handleCreate() {
    if (!question.trim()) {
      toast.error("Please enter a question");
      return;
    }
    if (options.some((opt) => !opt.trim())) {
      toast.error("Please fill in all options");
      return;
    }

    try {
      const { data: poll, error: pollError } = await supabase
        .from("polls")
        .insert({
          conversation_id: conversationId,
          creator_id: userId,
          question: question.trim(),
        })
        .select()
        .single();

      if (pollError || !poll) throw pollError || new Error("Poll creation failed");

      const optionsToInsert = options.map((text) => ({
        poll_id: poll.id,
        option_text: text.trim(),
      }));

      const { error: optionsError } = await supabase
        .from("poll_options")
        .insert(optionsToInsert);

      if (optionsError) throw optionsError;

      onCreated(poll.id);
      onClose();
      toast.success("Poll created!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create poll");
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-slate-900 border border-white/10 rounded-3xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-slate-800/50">
          <h3 className="font-display font-bold text-lg">Create Poll</h3>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>
        <div className="p-6 space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Question</label>
            <Input
              placeholder="What do you want to ask?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="bg-slate-800 border-white/10 focus:ring-violet-500 text-white"
            />
          </div>
          <div className="space-y-3">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Options</label>
            <div className="space-y-2">
              {options.map((opt, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    placeholder={`Option ${i + 1}`}
                    value={opt}
                    onChange={(e) => {
                      const newOpts = [...options];
                      newOpts[i] = e.target.value;
                      setOptions(newOpts);
                    }}
                    className="bg-slate-800 border-white/10 focus:ring-violet-500 text-white"
                  />
                  {options.length > 2 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeOption(i)}
                      className="text-slate-400 hover:text-rose-400"
                    >
                      <Minus className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={addOption}
              className="w-full border border-dashed border-white/10 text-slate-400 hover:text-white hover:bg-white/5"
            >
              <Plus className="w-4 h-4 mr-2" /> Add Option
            </Button>
          </div>
        </div>
        <div className="p-4 bg-slate-800/30 border-t border-white/10 flex gap-3">
          <Button variant="ghost" onClick={onClose} className="flex-1 text-slate-400">Cancel</Button>
          <Button onClick={handleCreate} className="flex-1 bg-violet-600 hover:bg-violet-500 text-white font-bold">Create Poll</Button>
        </div>
      </div>
    </div>
  );
}

export function PollMessage({
  pollId,
  userId,
}: {
  pollId: string;
  userId: string;
}) {
  const qc = useQueryClient();
  const [votedOption, setVotedOption] = useState<string | null>(null);

  const { data: poll } = useQuery({
    queryKey: ["poll", pollId],
    queryFn: async () => {
      const { data } = await supabase.from("polls").select("*").eq("id", pollId).single();
      return data as Poll;
    },
  });

  const { data: options = [] } = useQuery({
    queryKey: ["poll-options", pollId],
    enabled: !!pollId,
    queryFn: async () => {
      const { data } = await supabase.from("poll_options").select("*").eq("poll_id", pollId);
      return (data ?? []) as PollOption[];
    },
  });

  const { data: votes = [] } = useQuery({
    queryKey: ["poll-votes", pollId],
    enabled: !!pollId,
    queryFn: async () => {
      const { data } = await supabase.from("poll_votes").select("*").eq("poll_id", pollId);
      return (data ?? []) as PollVote[];
    },
  });

  useEffect(() => {
    const myVote = votes.find(v => v.user_id === userId);
    if (myVote) setVotedOption(myVote.option_id);
  }, [votes, userId]);

  async function handleVote(optionId: string) {
    if (votedOption) {
      toast.info("You have already voted in this poll");
      return;
    }

    try {
      const { error } = await supabase.from("poll_votes").insert({
        poll_id: pollId,
        option_id: optionId,
        user_id: userId,
      });

      if (error) throw error;

      setVotedOption(optionId);
      await qc.invalidateQueries({ queryKey: ["poll-votes", pollId] });
      toast.success("Vote cast!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Voting failed");
    }
  }

  if (!poll) return null;

  const totalVotes = votes.length;

  return (
    <div className="bg-slate-800 border border-white/10 rounded-2xl p-4 space-y-4 max-w-sm shadow-lg">
      <div className="space-y-1">
        <h4 className="font-bold text-white leading-tight">{poll.question}</h4>
        <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
          {totalVotes} {totalVotes === 1 ? "vote" : "votes"}
        </p>
      </div>
      <div className="space-y-2">
        {options.map((opt) => {
          const optionVotes = votes.filter(v => v.option_id === opt.id).length;
          const percentage = totalVotes > 0 ? Math.round((optionVotes / totalVotes) * 100) : 0;
          const isSelected = votedOption === opt.id;

          return (
            <button
              key={opt.id}
              onClick={() => handleVote(opt.id)}
              className={`w-full text-left relative overflow-hidden group transition-all duration-200 p-3 rounded-xl border ${
                isSelected
                ? "border-violet-500 bg-violet-500/10"
                : "border-white/5 bg-slate-900/50 hover:bg-slate-700/50"
              }`}
            >
              <div
                className="absolute inset-0 bg-violet-600/20 transition-all duration-500 ease-out pointer-events-none"
                style={{ width: `${percentage}%` }}
              />
              <div className="relative flex justify-between items-center z-10">
                <span className={`text-sm font-medium ${isSelected ? "text-violet-300" : "text-slate-200"}`}>
                  {opt.option_text}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-400">{percentage}%</span>
                  {isSelected && <CheckCircle2 className="w-4 h-4 text-violet-400" />}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
