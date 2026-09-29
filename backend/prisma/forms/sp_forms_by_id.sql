CREATE PROCEDURE sp_forms_by_id(IN p_id INT)
BEGIN
  SELECT
    vf.id,
    vf.form_name,
    vf.description,
    vf.created_at,
    vf.event_date,
    vf.expires_at,
    vf.open_at,
    vf.status,
    vf.is_draft,
    vf.is_closed,
    vf.closed_at,
    vf.inscription_limit,
    vf.conferencista,
    vf.ubicacion,
    COALESCE(fs.submission_count, 0) AS submission_count
  FROM vw_forms vf
  LEFT JOIN (
    SELECT form_id, COUNT(*) AS submission_count
    FROM form_submissions
    GROUP BY form_id
  ) fs ON fs.form_id = vf.id
  WHERE vf.id = p_id
  LIMIT 1;
END
