-- Backfill script: Create default Netball scoring system and assign to existing groups
--
-- Safe to re-run.

WITH existing_system AS (
  SELECT id
  FROM public.scoring_systems
  WHERE name = 'Standard Netball'
    AND sport_type = 'Netball'
  ORDER BY created_at
  LIMIT 1
),
inserted_system AS (
  INSERT INTO public.scoring_systems (
    name, sport_type,
    win_pts, draw_pts, loss_pts,
    bonus_loss_pts, bonus_loss_threshold_type, bonus_loss_threshold_value,
    forfeit_win_pts, forfeit_loss_pts, forfeit_win_score_for, forfeit_win_score_against
  )
  SELECT
    'Standard Netball', 'Netball',
    5, 3, 0,
    1, 'percentage', 50,
    5, 0, 5, 0
  WHERE NOT EXISTS (SELECT 1 FROM existing_system)
  RETURNING id
),
selected_system AS (
  SELECT id FROM existing_system
  UNION ALL
  SELECT id FROM inserted_system
  LIMIT 1
)
UPDATE public.age_groups
SET scoring_system_id = (SELECT id FROM selected_system)
WHERE scoring_system_id IS NULL;
