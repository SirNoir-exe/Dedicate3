// Converts DB rows (snake_case) to the camelCase shape the frontend receives.
function serializeDedication(r) {
  return {
    id: r.id,
    fromName: r.from_name,
    toName: r.to_name,
    song: r.song,
    artist: r.artist,
    meal: r.meal,
    comment: r.comment,
    playDate: r.play_date,
    status: r.status,
    statusNote: r.status_note,
    handledAt: r.handled_at,
    createdAt: r.created_at,
    // Only present on staff queries (joined from users)
    ...(r.submitted_by_name !== undefined && {
      submittedBy: {
        id: r.user_id,
        fullName: r.submitted_by_name,
        schoolEmail: r.submitted_by_email,
        className: r.submitted_by_class,
      },
    }),
    ...(r.handled_by_name !== undefined && { handledByName: r.handled_by_name }),
  };
}

module.exports = { serializeDedication };
