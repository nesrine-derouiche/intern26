/// Les colonnes `numeric` de PostgreSQL sont sérialisées en chaîne par pg
/// (ex. `note_finale` -> `"16.40"`, agrégats de stats -> `"1"`).
/// `numOrNull` accepte donc `num`, chaîne numérique ou `null`.
num? numOrNull(Object? value) {
  if (value == null) return null;
  if (value is num) return value;
  return num.tryParse(value.toString());
}
