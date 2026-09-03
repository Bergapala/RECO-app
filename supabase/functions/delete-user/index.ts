// Edge Function "delete-user" — supprime définitivement le compte de
// l'utilisateur qui appelle cette fonction (jamais un autre : l'id est
// toujours dérivé du jeton de session envoyé dans l'en-tête Authorization,
// jamais d'un id transmis dans le corps de la requête — sinon n'importe qui
// pourrait supprimer le compte de n'importe qui).
//
// Appelée depuis l'app via `supabase.functions.invoke('delete-user')` (voir
// src/lib/auth.ts, deleteAccount()) — supabase-js y attache automatiquement
// le jeton de la session en cours.
//
// SUPABASE_URL, SUPABASE_ANON_KEY et SUPABASE_SERVICE_ROLE_KEY sont
// injectés automatiquement dans l'environnement de chaque Edge Function par
// Supabase — aucun secret à configurer manuellement pour ceux-là.
//
// Déploiement : `supabase functions deploy delete-user` (nécessite le
// Supabase CLI et d'être lié au projet — `supabase link`).
//
// La suppression de la ligne auth.users entraîne la suppression en cascade
// de la ligne public.users (on delete cascade) et donc, en cascade encore,
// de tout ce qui en dépend : recos, commentaires, réactions, amis,
// enregistrements, notifications (voir supabase/migrations). Rien d'autre à
// supprimer manuellement ici.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Méthode non autorisée.' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Session manquante.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Client borné au jeton de l'appelant — sert uniquement à vérifier qui
  // appelle, jamais à effectuer la suppression elle-même (pas de droits
  // service_role ici).
  const supabaseUser = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } },
  );

  const {
    data: { user },
    error: userError,
  } = await supabaseUser.auth.getUser();

  if (userError || !user) {
    return new Response(JSON.stringify({ error: 'Session invalide ou expirée.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Client admin (service_role) — seul habilité à supprimer un compte Auth.
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);

  if (deleteError) {
    return new Response(JSON.stringify({ error: deleteError.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
