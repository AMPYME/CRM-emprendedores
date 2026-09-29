CREATE PROCEDURE sp_form_submissions(
  IN p_form_id INT,
  IN p_limit INT,
  IN p_offset INT
)
BEGIN
  IF p_form_id IS NULL OR p_form_id < 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'formulario invalido';
  END IF;

  SET @lim = IF(p_limit IS NULL OR p_limit < 1, 20, p_limit);
  SET @off = IF(p_offset IS NULL OR p_offset < 0, 0, p_offset);

  SELECT COUNT(*) AS total
    FROM form_submissions
   WHERE form_id = p_form_id;

  SET @sql = CONCAT(
    'SELECT fs.id AS id, fs.user_id AS user_id, fs.submitted_at AS submitted_at, ',
    'r.cedula AS cedula, r.nombre AS nombre, r.apellido AS apellido, ',
    'r.provincia AS provincia, r.telefono AS telefono ',
    'FROM form_submissions fs ',
    'JOIN `form_', p_form_id, '_responses` r ON r.id = fs.response_id ',
    'WHERE fs.form_id = ', p_form_id, ' ',
    'ORDER BY fs.submitted_at DESC ',
    'LIMIT ', @lim, ' OFFSET ', @off
  );

  PREPARE stmt FROM @sql;
  EXECUTE stmt;
  DEALLOCATE PREPARE stmt;
END
