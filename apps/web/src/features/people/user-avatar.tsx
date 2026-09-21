'use client';

import { useParams } from 'next/navigation';
import { useMe, useOrganizationMembers } from '@pmtool/api-client';
import { Avatar, type AvatarProps } from '@pmtool/ui';

/**
 * A person shown as their mascot character, the same on every screen. Pass the
 * character when the payload already carries it (task assignees); otherwise it is
 * looked up by user id from the organization's member list, which is fetched
 * once and shared. Someone who is no longer a member falls back to initials.
 */
export function UserAvatar({
  userId,
  name,
  character,
  size = 'sm',
  className,
}: {
  userId?: string | null;
  name: string;
  character?: string | null;
  size?: AvatarProps['size'];
  className?: string;
}) {
  const { orgSlug } = useParams<{ orgSlug?: string }>();
  const { data: members } = useOrganizationMembers(character ? undefined : orgSlug);
  const { data: me } = useMe();
  const found =
    character ??
    (userId && me?.id === userId ? me.mascotCharacter : undefined) ??
    members?.find((m) => m.userId === userId)?.user?.mascotCharacter;
  return <Avatar name={name} character={found} size={size} className={className} />;
}
