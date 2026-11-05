package br.com.argousForms.protocolos;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/** Catálogo das variáveis nativas, disponíveis somente para leitura. */
public final class VariaveisSistema {

	public record Definicao( String codigo, String tipoDado, String descricao ) {}

	public record Usuario( UUID id, String nome, String email ) {}

	public record Processo( UUID id, Instant inicio, Usuario iniciador, Usuario gestor ) {}

	public record Etapa( UUID id, String titulo, Instant inicio, Usuario responsavel ) {}

	public record Contexto( Instant instante, ZoneId fusoHorario, String nomeInstituicao,
		Usuario usuarioAtual, Processo processo, Etapa etapa ) {}

	private static final List<Definicao> DEFINICOES = List.of(
		new Definicao( "sistema.dataAtual", "D", "Data no momento da ação" ),
		new Definicao( "sistema.horaAtual", "H", "Hora no momento da ação" ),
		new Definicao( "sistema.dataHoraAtual", "T", "Instante no momento da ação" ),
		new Definicao( "instituicao.nome", "S", "Nome atual da instituição" ),
		new Definicao( "usuarioAtual.id", "S", "Identificador de quem executa a ação" ),
		new Definicao( "usuarioAtual.nome", "S", "Nome de quem executa a ação" ),
		new Definicao( "usuarioAtual.email", "S", "E-mail de quem executa a ação" ),
		new Definicao( "processo.id", "S", "Identificador do Processo" ),
		new Definicao( "processo.dataInicio", "T", "Instante em que o Processo começou" ),
		new Definicao( "processo.usuarioIniciador.id", "S", "Identificador de quem iniciou o Processo" ),
		new Definicao( "processo.usuarioIniciador.nome", "S", "Nome de quem iniciou o Processo" ),
		new Definicao( "processo.usuarioGestor.id", "S", "Identificador do gestor vigente" ),
		new Definicao( "processo.usuarioGestor.nome", "S", "Nome do gestor vigente" ),
		new Definicao( "etapa.id", "S", "Identificador da etapa em execução" ),
		new Definicao( "etapa.titulo", "S", "Título da etapa em execução" ),
		new Definicao( "etapa.dataInicio", "T", "Instante em que a etapa começou" ),
		new Definicao( "etapa.responsavel.id", "S", "Identificador do responsável vigente" ),
		new Definicao( "etapa.responsavel.nome", "S", "Nome do responsável vigente" )
	);

	private VariaveisSistema() {}

	public static List<Definicao> definicoes() { return DEFINICOES; }

	public static JSONArray catalogo() throws JSONException {

		JSONArray resultado = new JSONArray();
		for( Definicao definicao : DEFINICOES ) {
			resultado.put( new JSONObject().put( "codigo", definicao.codigo() )
				.put( "tipoDado", definicao.tipoDado() ).put( "descricao", definicao.descricao() ) );
		}
		return resultado;
	}

	public static Object resolver( String codigo, Contexto contexto ) {

		if( contexto == null || contexto.instante() == null || contexto.fusoHorario() == null ) {
			throw new IllegalArgumentException( "Informe o instante e o fuso horário do contexto." );
		}
		OffsetDateTime agora = contexto.instante().atZone( contexto.fusoHorario() ).toOffsetDateTime();
		Processo processo = contexto.processo();
		Etapa etapa = contexto.etapa();

		return switch( codigo ) {
			case "sistema.dataAtual" -> agora.toLocalDate();
			case "sistema.horaAtual" -> agora.toLocalTime();
			case "sistema.dataHoraAtual" -> agora;
			case "instituicao.nome" -> contexto.nomeInstituicao();
			case "usuarioAtual.id" -> id( contexto.usuarioAtual() );
			case "usuarioAtual.nome" -> nome( contexto.usuarioAtual() );
			case "usuarioAtual.email" -> contexto.usuarioAtual() == null ? null : contexto.usuarioAtual().email();
			case "processo.id" -> processo == null ? null : texto( processo.id() );
			case "processo.dataInicio" -> processo == null ? null : horario( processo.inicio(), contexto.fusoHorario() );
			case "processo.usuarioIniciador.id" -> processo == null ? null : id( processo.iniciador() );
			case "processo.usuarioIniciador.nome" -> processo == null ? null : nome( processo.iniciador() );
			case "processo.usuarioGestor.id" -> processo == null ? null : id( processo.gestor() );
			case "processo.usuarioGestor.nome" -> processo == null ? null : nome( processo.gestor() );
			case "etapa.id" -> etapa == null ? null : texto( etapa.id() );
			case "etapa.titulo" -> etapa == null ? null : etapa.titulo();
			case "etapa.dataInicio" -> etapa == null ? null : horario( etapa.inicio(), contexto.fusoHorario() );
			case "etapa.responsavel.id" -> etapa == null ? null : id( etapa.responsavel() );
			case "etapa.responsavel.nome" -> etapa == null ? null : nome( etapa.responsavel() );
			default -> throw new IllegalArgumentException( "Variável de sistema desconhecida: " + codigo );
		};
	}

	private static String id( Usuario usuario ) { return usuario == null ? null : texto( usuario.id() ); }

	private static String nome( Usuario usuario ) { return usuario == null ? null : usuario.nome(); }

	private static String texto( UUID id ) { return id == null ? null : id.toString(); }

	private static OffsetDateTime horario( Instant instante, ZoneId fuso ) {

		return instante == null ? null : instante.atZone( fuso ).toOffsetDateTime();
	}
}
