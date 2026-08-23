import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Ban,
  MessageCircle,
  Search,
  UserMinus,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRealtime } from "@/components/RealtimeProvider";
import { AppShell, PageHeader } from "@/components/AppShell";
import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import type { Profile } from "@/lib/whatsxup";

type ContactRow = {
  id: string;
  contact_id: string;
  profiles: Profile;
};

type BlockedRow = {
  id: string;
  blocked_id: string;
  profiles: Profile;
};

export const Route = createFileRoute("/_authenticated/contacts")({
  head: () => ({
    meta: [
      {
        title: "Contacts — WHATSXUP",
      },
      {
        name: "description",
        content:
          "Find WHATSXUP people by username, message them instantly and manage your contact list.",
      },
      {
        property: "og:title",
        content: "Contacts — WHATSXUP",
      },
      {
        property: "og:description",
        content:
          "Search usernames and start chatting instantly — no requests needed.",
      },
    ],
  }),
  component: ContactsPage,
});

function ContactsPage() {
  const { user } = useAuth();
  const { onlineIds } = useRealtime();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [term, setTerm] = useState("");

  /*
   * ---------------------------------------------------------
   * CONTACTS
   * ---------------------------------------------------------
   */

  const {
    data: contacts = [],
    isLoading: contactsLoading,
  } = useQuery<ContactRow[]>({
    queryKey: ["contacts", user?.id],
    enabled: !!user,

    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("contacts")
        .select(
          "id, contact_id, profiles:contact_id(id, username, display_name, avatar_url, bio, discoverable)",
        )
        .eq("owner_id", user.id);

      if (error) throw error;

      return (data ?? []) as unknown as ContactRow[];
    },
  });

  /*
   * ---------------------------------------------------------
   * BLOCKED USERS
   * ---------------------------------------------------------
   */

  const {
    data: blocked = [],
    isLoading: blockedLoading,
  } = useQuery<BlockedRow[]>({
    queryKey: ["blocks", user?.id],
    enabled: !!user,

    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("blocks")
        .select(
          "id, blocked_id, profiles:blocked_id(id, username, display_name, avatar_url, bio, discoverable)",
        )
        .eq("blocker_id", user.id);

      if (error) throw error;

      return (data ?? []) as unknown as BlockedRow[];
    },
  });

  /*
   * ---------------------------------------------------------
   * USER SEARCH
   * ---------------------------------------------------------
   */

  const {
    data: results = [],
    isFetching,
  } = useQuery({
    queryKey: ["user-search", term],
    enabled:
      !!user &&
      term.trim().length >= 2,

    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, username, display_name, avatar_url, bio, discoverable",
        )
        .eq("discoverable", true)
        .neq("id", user.id)
        .ilike(
          "username",
          `${term.trim().toLowerCase()}%`,
        )
        .limit(20);

      if (error) throw error;

      return (data ?? []) as Partial<Profile>[];
    },
  });

  /*
   * ---------------------------------------------------------
   * REFRESH DATA
   * ---------------------------------------------------------
   */

  function refreshContacts() {
    void qc.invalidateQueries({
      queryKey: ["contacts", user?.id],
    });

    void qc.invalidateQueries({
      queryKey: ["blocks", user?.id],
    });

    void qc.invalidateQueries({
      queryKey: ["is-contact"],
    });
  }

  /*
   * ---------------------------------------------------------
   * ADD CONTACT
   * ---------------------------------------------------------
   */

  const addContact = useMutation({
    mutationFn: async (contactId: string) => {
      if (!user) {
        throw new Error("You must be signed in.");
      }

      /*
       * Do not allow adding somebody who is already blocked.
       */

      const alreadyBlocked = blocked.some(
        (item) =>
          item.blocked_id === contactId,
      );

      if (alreadyBlocked) {
        throw new Error(
          "Unblock this user before adding them as a contact.",
        );
      }

      const { error } = await supabase
        .from("contacts")
        .insert({
          owner_id: user.id,
          contact_id: contactId,
        });

      if (error) throw error;
    },

    onSuccess: () => {
      toast.success("Added to contacts");
      refreshContacts();
    },

    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  /*
   * ---------------------------------------------------------
   * REMOVE CONTACT
   * ---------------------------------------------------------
   */

  const removeContact = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("contacts")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },

    onSuccess: () => {
      /*
       * Refresh the contacts list immediately.
       */

      void qc.invalidateQueries({
        queryKey: ["contacts", user?.id],
      });

      toast.success("Contact removed");
    },

    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  /*
   * ---------------------------------------------------------
   * BLOCK USER
   *
   * IMPORTANT:
   * We update the React Query cache immediately.
   * This means the blocked person appears in the
   * Blocked tab immediately instead of waiting for
   * another database request.
   * ---------------------------------------------------------
   */

  const block = useMutation({
    mutationFn: async (blockedId: string) => {
      if (!user) {
        throw new Error("You must be signed in.");
      }

      /*
       * Prevent duplicate blocking.
       */

      const alreadyBlocked = blocked.some(
        (item) =>
          item.blocked_id === blockedId,
      );

      if (alreadyBlocked) {
        throw new Error(
          "This user is already blocked.",
        );
      }

      /*
       * Get the profile first so we can immediately
       * put the complete person into the Blocked tab.
       */

      const existingContact =
        contacts.find(
          (contact) =>
            contact.contact_id === blockedId,
        );

      let profile: Profile | null =
        existingContact?.profiles ?? null;

      /*
       * If the user isn't currently a contact,
       * fetch their profile.
       */

      if (!profile) {
        const { data, error } =
          await supabase
            .from("profiles")
            .select(
              "id, username, display_name, avatar_url, bio, discoverable",
            )
            .eq("id", blockedId)
            .maybeSingle();

        if (error) throw error;

        profile =
          (data as Profile | null) ??
          null;
      }

      /*
       * Insert the block into Supabase.
       */

      const { data: insertedBlock, error } =
        await supabase
          .from("blocks")
          .insert({
            blocker_id: user.id,
            blocked_id: blockedId,
          })
          .select("id, blocked_id")
          .single();

      if (error) throw error;

      /*
       * Remove the user from contacts.
       */

      const {
        error: contactDeleteError,
      } = await supabase
        .from("contacts")
        .delete()
        .eq("owner_id", user.id)
        .eq("contact_id", blockedId);

      if (contactDeleteError) {
        console.warn(
          "Could not remove blocked user from contacts:",
          contactDeleteError,
        );
      }

      return {
        id: insertedBlock.id,
        blocked_id: blockedId,
        profiles:
          profile ??
          ({
            id: blockedId,
            username: null,
            display_name: "User",
            avatar_url: null,
            bio: null,
            discoverable: false,
          } as Profile),
      } as BlockedRow;
    },

    /*
     * -------------------------------------------------------
     * OPTIMISTIC UI
     * -------------------------------------------------------
     */

    onSuccess: (newBlockedUser) => {
      /*
       * Immediately add the blocked user to the cached
       * blocked list.
       */

      qc.setQueryData<BlockedRow[]>(
        ["blocks", user?.id],
        (current = []) => {
          /*
           * Safety check against duplicates.
           */

          if (
            current.some(
              (item) =>
                item.blocked_id ===
                newBlockedUser.blocked_id,
            )
          ) {
            return current;
          }

          return [
            ...current,
            newBlockedUser,
          ];
        },
      );

      /*
       * Immediately remove the person from the
       * Contacts cache.
       */

      qc.setQueryData<ContactRow[]>(
        ["contacts", user?.id],
        (current = []) =>
          current.filter(
            (item) =>
              item.contact_id !==
              newBlockedUser.blocked_id,
          ),
      );

      /*
       * Refresh from Supabase in the background
       * to make sure the cache matches the database.
       */

      void qc.invalidateQueries({
        queryKey: ["blocks", user?.id],
      });

      void qc.invalidateQueries({
        queryKey: ["contacts", user?.id],
      });

      void qc.invalidateQueries({
        queryKey: ["is-contact"],
      });

      toast.success(
        "User blocked and moved to Blocked",
      );

      /*
       * Automatically switch to the Blocked tab.
       */

      window.setTimeout(() => {
        const blockedTab =
          document.querySelector(
            '[data-state="active"][value="blocked"]',
          );

        if (!blockedTab) {
          const trigger =
            document.querySelector(
              'button[value="blocked"]',
            ) as HTMLButtonElement | null;

          trigger?.click();
        }
      }, 50);
    },

    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  /*
   * ---------------------------------------------------------
   * UNBLOCK USER
   * ---------------------------------------------------------
   */

  const unblock = useMutation({
    mutationFn: async (blockId: string) => {
      if (!user) {
        throw new Error("You must be signed in.");
      }

      const { error } = await supabase
        .from("blocks")
        .delete()
        .eq("id", blockId)
        .eq("blocker_id", user.id);

      if (error) throw error;

      return blockId;
    },

    /*
     * -------------------------------------------------------
     * REMOVE FROM BLOCKED CACHE IMMEDIATELY
     * -------------------------------------------------------
     */

    onSuccess: (blockId) => {
      qc.setQueryData<BlockedRow[]>(
        ["blocks", user?.id],
        (current = []) =>
          current.filter(
            (item) => item.id !== blockId,
          ),
      );

      void qc.invalidateQueries({
        queryKey: ["blocks", user?.id],
      });

      void qc.invalidateQueries({
        queryKey: ["contacts", user?.id],
      });

      void qc.invalidateQueries({
        queryKey: ["is-contact"],
      });

      toast.success("User unblocked");
    },

    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  /*
   * ---------------------------------------------------------
   * OPEN CHAT
   * ---------------------------------------------------------
   */

  async function openChat(otherId: string) {
    if (!user) return;

    /*
     * Don't allow opening a chat with somebody
     * you have blocked.
     */

    const isBlocked = blocked.some(
      (item) =>
        item.blocked_id === otherId,
    );

    if (isBlocked) {
      toast.error(
        "Unblock this user before messaging them.",
      );
      return;
    }

    const { data, error } =
      await supabase.rpc(
        "get_or_create_direct",
        {
          _other: otherId,
        },
      );

    if (error || !data) {
      toast.error(
        error?.message ??
          "Could not open chat",
      );
      return;
    }

    void navigate({
      to: "/chats/$id",
      params: {
        id: data,
      },
    });
  }

  /*
   * ---------------------------------------------------------
   * HELPERS
   * ---------------------------------------------------------
   */

  const isContact = (uid: string) =>
    contacts.some(
      (contact) =>
        contact.contact_id === uid,
    );

  const isBlocked = (uid: string) =>
    blocked.some(
      (item) =>
        item.blocked_id === uid,
    );

  /*
   * ---------------------------------------------------------
   * RENDER
   * ---------------------------------------------------------
   */

  return (
    <AppShell>
      <PageHeader
        title="Contacts"
        subtitle="Find anyone by their WHATSXUP username"
      />

      <div className="p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

          <Input
            className="pl-9"
            placeholder="Search @username"
            value={term}
            maxLength={20}
            onChange={(event) =>
              setTerm(
                event.target.value
                  .replace(
                    /[^a-zA-Z0-9_]/g,
                    "",
                  )
                  .toLowerCase(),
              )
            }
          />
        </div>
      </div>

      {term.trim().length >= 2 ? (
        /*
         * -----------------------------------------------------
         * SEARCH RESULTS
         * -----------------------------------------------------
         */

        <section className="px-4 pb-6">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {isFetching
              ? "Searching…"
              : `Results (${results.length})`}
          </h2>

          <ul className="space-y-2">
            {results.map((profile) => {
              if (!profile.id) {
                return null;
              }

              const blockedUser =
                isBlocked(profile.id);

              return (
                <li
                  key={profile.id}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3"
                >
                  <UserAvatar
                    path={
                      profile.avatar_url ??
                      null
                    }
                    name={
                      profile.display_name ??
                      profile.username ??
                      "User"
                    }
                    online={onlineIds.has(
                      profile.id,
                    )}
                  />

                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {profile.display_name ??
                        profile.username ??
                        "User"}
                    </p>

                    <p className="truncate text-xs text-muted-foreground">
                      @{profile.username}
                    </p>
                  </div>

                  {blockedUser ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const item =
                          blocked.find(
                            (blockItem) =>
                              blockItem.blocked_id ===
                              profile.id,
                          );

                        if (item) {
                          unblock.mutate(
                            item.id,
                          );
                        }
                      }}
                    >
                      Unblock
                    </Button>
                  ) : (
                    <>
                      {!isContact(
                        profile.id,
                      ) && (
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Add contact"
                          onClick={() =>
                            addContact.mutate(
                              profile.id!,
                            )
                          }
                        >
                          <UserPlus className="h-4 w-4" />
                        </Button>
                      )}

                      <Button
                        size="sm"
                        onClick={() =>
                          void openChat(
                            profile.id!,
                          )
                        }
                      >
                        <MessageCircle className="h-4 w-4" />
                        Message
                      </Button>
                    </>
                  )}
                </li>
              );
            })}

            {!isFetching &&
              results.length === 0 && (
                <li className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  No discoverable user matches
                  that username.
                </li>
              )}
          </ul>
        </section>
      ) : (
        /*
         * -----------------------------------------------------
         * CONTACT / BLOCKED TABS
         * -----------------------------------------------------
         */

        <Tabs
          defaultValue="contacts"
          className="px-4 pb-6"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="contacts">
              Contacts{" "}
              {contacts.length
                ? `(${contacts.length})`
                : ""}
            </TabsTrigger>

            <TabsTrigger value="blocked">
              Blocked{" "}
              {blocked.length
                ? `(${blocked.length})`
                : ""}
            </TabsTrigger>
          </TabsList>

          /*
           * ---------------------------------------------------
           * CONTACTS TAB
           * ---------------------------------------------------
           */

          <TabsContent
            value="contacts"
            className="mt-4 space-y-2"
          >
            {contacts.length === 0 && (
              <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                No contacts yet — search a
                username above and tap
                Message or add them here.
              </p>
            )}

            {contacts.map((contact) => (
              <div
                key={contact.id}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3"
              >
                <UserAvatar
                  path={
                    contact.profiles
                      .avatar_url
                  }
                  name={
                    contact.profiles
                      .display_name ??
                    contact.profiles
                      .username ??
                    "User"
                  }
                  online={onlineIds.has(
                    contact.contact_id,
                  )}
                />

                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {contact.profiles
                      .display_name ??
                      contact.profiles
                        .username ??
                      "User"}
                  </p>

                  <p className="truncate text-xs text-muted-foreground">
                    @
                    {
                      contact.profiles
                        .username
                    }
                  </p>
                </div>

                <Button
                  size="icon"
                  variant="outline"
                  title="Message"
                  onClick={() =>
                    void openChat(
                      contact.contact_id,
                    )
                  }
                >
                  <MessageCircle className="h-4 w-4" />
                </Button>

                <Button
                  size="icon"
                  variant="ghost"
                  title="Remove contact"
                  disabled={
                    removeContact.isPending
                  }
                  onClick={() =>
                    removeContact.mutate(
                      contact.id,
                    )
                  }
                >
                  <UserMinus className="h-4 w-4" />
                </Button>

                <Button
                  size="icon"
                  variant="ghost"
                  title="Block"
                  disabled={block.isPending}
                  onClick={() =>
                    block.mutate(
                      contact.contact_id,
                    )
                  }
                >
                  <Ban className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </TabsContent>

          /*
           * ---------------------------------------------------
           * BLOCKED TAB
           * ---------------------------------------------------
           */

          <TabsContent
            value="blocked"
            className="mt-4 space-y-2"
          >
            {blockedLoading &&
              blocked.length === 0 && (
                <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
                  Loading blocked users…
                </div>
              )}

            {!blockedLoading &&
              blocked.length === 0 && (
                <div className="rounded-2xl border border-dashed border-border p-6 text-center">
                  <Ban className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />

                  <p className="font-medium">
                    No blocked users
                  </p>

                  <p className="mt-1 text-sm text-muted-foreground">
                    People you block will
                    appear here immediately.
                  </p>
                </div>
              )}

            {blocked.map((blockedUser) => (
              <div
                key={blockedUser.id}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3"
              >
                <UserAvatar
                  path={
                    blockedUser.profiles
                      .avatar_url
                  }
                  name={
                    blockedUser.profiles
                      .display_name ??
                    blockedUser.profiles
                      .username ??
                    "User"
                  }
                />

                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {blockedUser.profiles
                      .display_name ??
                      blockedUser.profiles
                        .username ??
                      "User"}
                  </p>

                  <p className="truncate text-xs text-muted-foreground">
                    @
                    {
                      blockedUser.profiles
                        .username
                    }
                  </p>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  disabled={
                    unblock.isPending
                  }
                  onClick={() =>
                    unblock.mutate(
                      blockedUser.id,
                    )
                  }
                >
                  Unblock
                </Button>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      )}
    </AppShell>
  );
}